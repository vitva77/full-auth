const Users = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendMail = require('./sendMail');

const { CLIENT_URL } = process.env;

const userCtrl = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password)
        return res
          .status(400)
          .json({ msg: 'You must fill in all of the fields.' });

      if (!validateEmail(email))
        return res.status(400).json({ msg: 'Invalid email address.' });

      const user = await Users.findOne({ email });

      if (user)
        return res.status(400).json({ msg: 'This email already exists.' });

      // if (password.length < 6)
      //   return res
      //     .status(400)
      //     .json({ msg: 'Password must contain at least 6 characters.' });

      if (!validatePassword(password))
        return res.status(400).json({
          msg:
            'Password must be at least 6 characters long one uppercase with one lowercase & one numeric character.',
        });

      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = {
        username,
        email,
        password: passwordHash,
      };

      const activation_token = createActivationToken(newUser);

      const url = `${CLIENT_URL}/user/activate/${activation_token}`;

      // sendMail(email, url, 'Verify your email address');
      console.log({ activation_token: activation_token, url: url });

      res.json({
        msg: 'Register success! Please activate your email to start.',
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  activateEmail: async (req, res) => {
    try {
      const { activation_token } = req.body;
      const user = jwt.verify(
        activation_token,
        process.env.ACTIVATION_TOKEN_SECRET
      );

      const { username, email, password } = user;

      const check = await Users.findOne({ email });
      if (check)
        return res.status(400).json({ msg: 'This email already exists.' });

      const newUser = new Users({
        username,
        email,
        password,
      });

      await newUser.save();

      res.json({ msg: 'Account has been activated!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password)
        return res
          .status(400)
          .json({ msg: 'You must fill in all of the fields.' });

      if (!validateEmail(email))
        return res.status(400).json({ msg: 'Invalid email address.' });

      const user = await Users.findOne({ email });
      if (!user)
        // return res.status(400).json({ msg: 'We could not find an account with that email.' });
        return res.status(400).json({ msg: 'Incorrect email or password.' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        // return res.status(400).json({ msg: 'The password you entered is incorrect. Please try again.' });
        return res.status(400).json({ msg: 'Incorrect email or password.' });

      console.log(user);

      const refresh_token = createRefreshToken({ id: user._id });
      res.cookie('refreshToken', refresh_token, {
        httpOnly: true,
        path: '/user/refresh_token',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ msg: 'Login success!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getAccessToken: async (req, res) => {
    try {
      const rf_token = req.cookies.refreshToken;

      if (!rf_token) return res.status(400).json({ msg: 'Please login now!' });

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(400).json({ msg: 'Please login now!' });

        const access_token = createAccessToken({ id: user.id });
        res.json({ access_token });
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email)
        return res.status(400).json({ msg: 'Email address is required.' });

      if (!validateEmail(email))
        return res.status(400).json({ msg: 'Invalid email address.' });

      const user = await Users.findOne({ email });
      if (!user)
        return res
          .status(400)
          .json({ msg: 'We could not find an account with that email.' });

      const access_token = createAccessToken({ id: user._id });

      const url = `${CLIENT_URL}/user/password_reset/${access_token}`;

      // sendMail(email, url, 'Reset your password')
      console.log({ access_token: access_token, url: url });

      res.json({ msg: 'Please check your email to get reset password link.' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { password } = req.body;

      console.log(password);
      const passwordHash = await bcrypt.hash(password, 12);

      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          password: passwordHash,
        }
      );

      res.json({ msg: 'Your password has been changed successfully!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getUserInfor: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id).select('-password');

      res.json(user);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getUsersAllInfor: async (req, res) => {
    try {
      const users = await Users.find().select('-password');

      res.json(users);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  logout: async (req, res) => {
    try {
      res.clearCookie('refreshToken', { path: '/user/refresh_token' });

      return res.json({ msg: 'Logged out.' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  updateUser: async (req, res) => {
    try {
      const { username, avatar } = req.body;

      await Users.findOneAndUpdate({ _id: req.user.id }, { username, avatar });

      res.json({ msg: 'Update Success!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  updateUsersRole: async (req, res) => {
    try {
      const { role } = req.body;

      await Users.findOneAndUpdate({ _id: req.params.id }, { role });

      res.json({ msg: 'Update Success!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  deleteUser: async (req, res) => {
    try {
      await Users.findByIdAndDelete(req.params.id);

      res.json({ msg: 'Deleted Success!' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

const validateEmail = (email) => {
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

const validatePassword = (password) => {
  const pswrd = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{6,}$/;
  return pswrd.test(password);
};

const createActivationToken = (payload) => {
  return jwt.sign(payload, process.env.ACTIVATION_TOKEN_SECRET, {
    expiresIn: '5m',
  });
};

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
};

module.exports = userCtrl;
