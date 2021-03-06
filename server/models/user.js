
const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }

  },
  password: { type: String, require: true, minlength: 6 },
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    }
  }]
});



UserSchema.methods.toJSON = function () {
  let user = this;
  let userObject = user.toObject();

  return _.pick(userObject, ['_id', 'email']);
}

UserSchema.methods.generateAuthToken = function () {
  let user = this;                                        //we have to use a normal fn here because arrow fns do not have this keyword
  let access = 'auth';
  let token = jwt.sign({ _id: user._id.toHexString(), access }, 'abc123').toString();

  user.tokens = user.tokens.concat([{ access, token }]);    //could have user arr.push but it was causing some issues
  return user.save().then(() => {
    return token;
  });                                                       //we are returning this value to the server file where we can use another .then

};

UserSchema.methods.removeToken = function (token) {
  var user = this;

  return user.update({
    $pull: {
      tokens: {
        token: token
      }
    }
  });
};


//.static is used to create model methods
UserSchema.statics.findByToken = function (token) {
  let User = this; //notice the capital U
  let decoded;

  try {
    decoded = jwt.verify(token, 'abc123');
  } catch (e) {
    return Promise.reject('');
    // return new Promise((resolve, reject)=>{
    //   reject();
    // });
  }

  //in case of success
  return User.findOne({
    '_id': decoded._id,
    'tokens.token': token,      //quotes are required if there is  a dot in the value
    'tokens.access': 'auth'
  });
};

UserSchema.statics.findByCredentials = function (email, password) {
  var user = this;

  return User.findOne({ email }).then((user) => {
    if (!user) {
      return Promise.reject();   //will call the .catch in the post request
    }
    //we have wrapped bcrypt in a new promise because bcrypt does not support promises, it supports only callback functions
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {    //use bcrypt.compare to compare password and user.password

        if (res) {
          resolve(user);
        }
        reject();
      });

    });
  });
};



//mongoose middleware(see mongoose docs)
UserSchema.pre('save', function (next) {
  var user = this;

  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

let User = mongoose.model('User', UserSchema);


module.exports = {
  User
}




