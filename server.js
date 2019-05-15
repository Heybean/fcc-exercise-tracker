const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {useNewUrlParser: true} )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

let Schema = mongoose.Schema;
let exerciseSchema = new Schema({
  userId: {type: String, required: true},
  description: String,
  duration: Number,
  date: Date
});

let userSchema = new Schema({
  _id: {type: String, required: true},
  username: {type: String, required: true},
});

let User = mongoose.model("User", userSchema);
let Exercise = mongoose.model("Exercise", exerciseSchema);

// Not found middleware
/*app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})*/

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

app.post("/api/exercise/new-user", (req, res) => {
  let username = req.body.username;
  
  if (username.length <= 0){
    return res.type("txt").send("Username is required.");
  }
  
  // Check if username doesn't already exist, then create new entry
  User.findOne({"username": username}, (err, data) => {
    if (err) console.error(err);

    if (data != null){
      return res.type("txt").send(username + " already exists in database.");
    }
    else{
      // add user to database
      let id = Math.random().toString(36).substr(3, 8);
      let user = new User({"username": username, "_id": id});
      user.save((err, data) => {
        if (err) console.error(err);
        res.json({username: username, _id: data._id});
      });
    }
  });
})

app.get("/api/exercise/users", (req, res) => {
  User.find({}, (err, data) => {
    if (err) console.error(err);
    
    res.send(data.map((x) => {
      return {username: x.username, _id: x._id};
    }));
  });
});

app.post("/api/exercise/add", (req, res) => {
  let userId = req.body.userId;
  let description = req.body.description;
  let duration = req.body.duration;
  let dateTxt = req.body.date;
  let dateObj = null;
  
  User.findById(userId, (err, data) => {
    if (err) console.error(err);
    if (data == null){
      return res.type("txt").send("Invalid userId.");
    }
    
    if (description == null){
      return res.type("txt").send("Description required.");
    }
    else if (duration == null){
      return res.type("txt").send("Duration required.");
    }
    else if (duration <= 0){
      return res.type("txt").send("Duration must be greater than 0.");
    }
    else{
      // Add the exercise to user
      
      console.log("   Finding proper date.");
      if (dateTxt.match(/\d\d\d\d-\d\d-\d\d/)){
        dateObj = new Date(dateTxt);
      }
      else{
        dateObj = new Date();
      }
      
      if(isNaN(dateObj.getTime())){
        return res.type("txt").send("Invalid date.");
      }
      
      let YYYYMMDD = dateToYYYYMMDD(dateObj);
      
      // Add the new entry to exercises
      let exercise = new Exercise({
        userId: userId,
        description: description,
        duration: duration,
        date: dateObj
      });
      exercise.save((err, data) => {if (err) console.error(err)});
      
      res.json({
        username: data.username,
        _id: data._id,
        description: description,
        duration: duration,
        date: YYYYMMDD
      });
    }
  });
});

app.get("/api/exercise/log?", (req, res) => {
  console.log("Querying " + req.query.userId);
  
  User.findById(req.query.userId, (err, data) => {
    if (data == null){
      return res.type("txt").send("Invalid userId.");
    }
    
    let output = {
      username: data.username,
      _id: data._id
    }
    
    let query = Exercise.find({userId: req.query.userId});
    
    let from = new Date(req.query.from);
    let to = new Date(req.query.to);

    if(!isNaN(from.getTime())){
      console.log("   ... from " + req.query.from);
      output.from = req.query.from;
      query.find({date: {$gte: from}});
    }
    
    if (!isNaN(to.getTime())){
      console.log("   ... to " + req.query.to);
      output.to = req.query.to;
      query.to({date: {$lte: to}});
    }
    
    if (req.query.limit){
      let limit = parseInt(req.query.limit, 10);
      console.log("   ... limit " + limit);
      output.limit = req.query.limit;
      query.find({duration: {$lte: req.query.limit}});
    }
    
    query.exec((err, data) => {
      if (err) console.error(err);
      
      output.count = data.length;
      output.log = data.map((d) => {
        return {
          description: d.description,
          duration: d.duration,
          date: dateToYYYYMMDD(d.date)
        };
      });
      
      res.json(output);
    });
  });
});

function dateToYYYYMMDD(dateObj){
  return [dateObj.getFullYear(),
        ('0' + (dateObj.getMonth() + 1)).slice(-2),
        ('0' + dateObj.getDate()).slice(-2)
        ].join('-');
}