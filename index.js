const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const SpotifyWebApi = require('spotify-web-api-node');
const app = express();

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
    res.render('home', { user: req.user }); // Pass the user object
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

        // Pass user, playlist, and tracks to the template
        res.render('playlist', { user: req.user, playlist, tracks });
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

// Route to search for songs and add them to a playlist
app.post('/playlist/:playlistId/add-song', isAuthenticated, async (req, res) => {
    const playlistId = req.params.playlistId;
    const searchQuery = req.body.searchQuery;

    try {
        // Search for tracks using the Spotify API
        const searchResults = await spotifyApi.searchTracks(searchQuery, { limit: 5 });
        const tracks = searchResults.body.tracks.items;

        res.render('add-song', { tracks, playlistId });
    } catch (err) {
        console.error('Error searching for tracks:', err);
        res.status(500).send('Error searching for tracks');
    }
});

// Route to handle adding a selected song to the playlist
app.post('/playlist/:playlistId/add-song/:trackId', (req, res) => {
    const playlistId = req.params.playlistId;
    const trackId = req.params.trackId;

    try {
        // Add the selected track to the playlist using the Spotify API
        spotifyApi.addTracksToPlaylist(playlistId, [`spotify:track:${trackId}`]);
        res.redirect(`/playlist/${playlistId}`);
    } catch (err) {
        console.error('Error adding track to playlist:', err);
        res.status(500).send('Error adding track to playlist');
    }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


