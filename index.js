const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const SpotifyWebApi = require('spotify-web-api-node');
const app = express();

// Serve static files from the root directory
app.use(express.static(__dirname));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Specify the views directory
app.set('views', __dirname + '/views');

// Middleware to parse the request body
app.use(express.urlencoded({ extended: true }));

app.use(
  session({ secret: 'your-secret-key', resave: true, saveUninitialized: true })
);
app.use(passport.initialize());
app.use(passport.session());

// Import the Spotify API module
const spotifyApi = new SpotifyWebApi();

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

const playlists = [];

// Additional route for the root path
app.get('/', (req, res) => {
  res.render('home', { user: req.user });
});
  
// Route to initiate Spotify authentication
app.get('/login', passport.authenticate('spotify', { scope: ['user-read-private', 'playlist-modify-public', 'playlist-modify-private'] }));

// Route to handle the Spotify callback
// Route to handle the Spotify callback
app.get('/callback', passport.authenticate('spotify', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
  });
  
  
  

// Route to get user profile and playlists
app.get('/profile', isAuthenticated, async (req, res) => {
  if (!req.user.accessToken) {
      return res.status(401).send('No access token available');
  }
    spotifyApi.setAccessToken(req.user.accessToken);

    try {
        // Fetch user's playlists
        const data = await spotifyApi.getUserPlaylists(req.user.id);
        const userPlaylists = data.body.items;

        // Save the playlists to the object
        // Inside the '/profile' route
        playlists[req.user.id] = userPlaylists.map(playlist => ({
            ...playlist,
            tracks: [] // Initialize tracks as an empty array
        }));



        res.render('profile', { user: req.user, playlists: userPlaylists });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching playlists');
    }
});




  
// index.js

// index.js

// Inside the '/playlist/:playlistId' route// Inside the '/playlist/:playlistId' route
app.get('/playlist/:playlistId', isAuthenticated, async (req, res) => {
  const playlistId = req.params.playlistId;

  try {
      // Fetch playlist details
      const playlistData = await spotifyApi.getPlaylist(playlistId);
      const playlist = playlistData.body;

      // Fetch playlist tracks
      const tracksData = await spotifyApi.getPlaylistTracks(playlistId);
      const tracks = tracksData.body.items; // Use items directly

      console.log('Tracks Data:', tracksData.body); // Log tracks data to the console

      // Pass user, playlist, tracks, and access token to the template
      res.render('playlist', { user: req.user, playlist, tracks, accessToken: req.user.accessToken, searchResults: [] }); // Add accessToken
  } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching playlist details or tracks');
  }
});




// Route to create a new playlist
app.post('/create-playlist', isAuthenticated, async (req, res) => {
    const playlistName = req.body.playlistName;

    if (!playlistName) {
        return res.status(400).send('Playlist name is required.');
    }

    try {
        const data = await spotifyApi.createPlaylist(playlistName, { public: true });
        const newPlaylistId = data.body.id;
        res.redirect(`/playlist/${newPlaylistId}`);
    } catch (err) {
        console.error(err);

        // Check if the error is from Spotify API and has a response
        if (err.response && err.response.body && err.response.body.error) {
            return res.status(err.response.body.error.status || 500).send(err.response.body.error.message || 'Error creating playlist');
        }

        // Log the complete error details
        console.error('Error details:', err);

        res.status(500).send('Error creating playlist');
    }
});

app.get('/search', isAuthenticated, async (req, res) => {
    const searchQuery = req.query.query;
  
    try {
      const response = await spotifyApi.searchTracks(searchQuery, { limit: 5 });
      const tracks = response.body.tracks.items;
      res.json(tracks);
    } catch (err) {
      console.error('Error searching for tracks:', err);
      res.status(500).send('Error searching for tracks');
    }
  });
  
  app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/');
    });
});



// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


