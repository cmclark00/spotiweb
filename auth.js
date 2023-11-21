// auth.js
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const YouTubeStrategy = require('passport-youtube-v3').Strategy;

passport.use(
    new SpotifyStrategy(
      {
        clientID: '02ed3f3586a54f43b8a03143e937636a',
        clientSecret: 'a412c98385474978bbbca92756a63acd',
        callbackURL: 'https://coreymclark.com/callback', // Adjust accordingly
      },
      (accessToken, refreshToken, expires_in, profile, done) => {
        // Save user information to session or database
        profile.accessToken = accessToken; // Make sure to set the accessToken
        return done(null, profile);
      }
    )
  );
  
// YouTube Music authentication strategy
passport.use('youtube', new YouTubeStrategy({
  clientID: '12291341441-a1lloq2l4qikq2n3o224dneic92hmijc.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'https://coreymclark.com/youtube-callback',
}, (accessToken, refreshToken, profile, done) => {
  // Save user data to the database or session as needed
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

module.exports = passport;
