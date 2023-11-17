// auth.js
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;

passport.use(
    new SpotifyStrategy(
      {
        clientID: '02ed3f3586a54f43b8a03143e937636a',
        clientSecret: 'a412c98385474978bbbca92756a63acd',
        callbackURL: 'http://99.140.115.86:5000/callback', // Adjust accordingly
      },
      (accessToken, refreshToken, expires_in, profile, done) => {
        // Save user information to session or database
        profile.accessToken = accessToken; // Make sure to set the accessToken
        return done(null, profile);
      }
    )
  );
  

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

module.exports = passport;
