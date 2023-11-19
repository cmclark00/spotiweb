const { google } = require('googleapis');
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const SpotifyWebApi = require('spotify-web-api-node');
const uuid = require('uuid'); // Import the uuid library
const app = express();
const fetch = require('node-fetch');
// In-memory map to store the association between Spotify playlist IDs and custom UUIDs
const playlistIdToUuidMap = new Map();
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

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
      return next();
  }
  res.redirect('/login'); // Redirect to login if not authenticated
}

// Function to fetch YouTube profile information
const fetchYouTubeProfile = async (accessToken) => {
  const profileUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
  const playlistsUrl = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true';

  try {
    const [profileResponse, playlistsResponse] = await Promise.all([
      fetch(profileUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
      fetch(playlistsUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
    ]);

    if (!profileResponse.ok || !playlistsResponse.ok) {
      const errorMessage = `Error fetching YouTube profile or playlists. Status: ${profileResponse.status} / ${playlistsResponse.status}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const profileData = await profileResponse.json();
    const playlistsData = await playlistsResponse.json();

    return {
      youtubeProfile: profileData.items[0].snippet,
      youtubePlaylists: playlistsData.items
    };
  } catch (error) {
    console.error('Error in fetchYouTubeProfile:', error.message);
    throw error;
  }
};





const playlists = [];

// Additional route for the root path
app.get('/', (req, res) => {
  res.render('home', { user: req.user });
});

// Route to initiate YouTube Music authentication
app.get('/youtube-login', passport.authenticate('youtube', { scope: ['profile', 'https://www.googleapis.com/auth/youtube.readonly'] }));

// Route to handle the YouTube Music callback
app.get('/youtube-callback', passport.authenticate('youtube', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/youtube-profile');
});
  
// Route to initiate Spotify authentication
app.get('/login', passport.authenticate('spotify', { scope: ['user-read-private', 'playlist-modify-public', 'playlist-modify-private'] }));

// Route to handle the Spotify callback
// Route to handle the Spotify callback
app.get('/callback', passport.authenticate('spotify', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
  });
  
  // Assuming you have a route for the YouTube profile like this
app.get('/youtube-profile', ensureAuthenticated, async (req, res) => {
  try {
    const { youtubeProfile, youtubePlaylists } = await fetchYouTubeProfile(req.user.accessToken);
    res.render('youtube-profile', { user: req.user, youtubeProfile, youtubePlaylists });
  } catch (error) {
    console.error('Error fetching YouTube profile:', error);
    res.status(500).send(`Error fetching YouTube profile: ${error.message}`);
  }
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



app.get('/playlist/:playlistId', isAuthenticated, async (req, res) => {
  const playlistId = req.params.playlistId;

  // Check if a custom UUID is already associated with the Spotify playlist ID
  let privatePlaylistId = playlistIdToUuidMap.get(playlistId);

  // If not, generate a new custom UUID and associate it with the Spotify playlist ID
  if (!privatePlaylistId) {
      privatePlaylistId = uuid.v4();
      playlistIdToUuidMap.set(playlistId, privatePlaylistId);
  }

  console.log('UUID of the playlist:', privatePlaylistId); // Log the UUID to the console

  try {
      // Fetch playlist details
      const playlistData = await spotifyApi.getPlaylist(playlistId);
      const playlist = playlistData.body;

      // Fetch playlist tracks
      const tracksData = await spotifyApi.getPlaylistTracks(playlistId);
      const tracks = tracksData.body.items;

      console.log('Tracks Data:', tracksData.body); // Log tracks data to the console

      // Pass user, playlist, and tracks to the template, along with the privatePlaylistId
      res.render('playlist', { user: req.user, playlist, tracks, accessToken: req.user.accessToken, searchResults: [], privatePlaylistId });
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

app.post('/delete-playlist', isAuthenticated, async (req, res) => {
  const playlistId = req.body.playlistId;

  try {
    // Use the Spotify API to delete the playlist
    await spotifyApi.unfollowPlaylist(playlistId);

    // Update local data (in-memory object)
    const playlistIndex = playlists[req.user.id].findIndex((playlist) => playlist.id === playlistId);
    if (playlistIndex !== -1) {
      playlists[req.user.id].splice(playlistIndex, 1);
      console.log('Playlist deleted successfully');
    } else {
      console.log('Playlist not found locally');
    }

    // Redirect to the profile page with updated playlists
    res.redirect('/profile');
  } catch (error) {
    console.error('Error deleting playlist from Spotify API:', error);
    res.status(500).send('Error deleting playlist');
  }
});

// Route to remove a track from a playlist
app.post('/remove-track', isAuthenticated, async (req, res) => {
  const playlistId = req.body.playlistId;
  const trackId = req.body.trackId;

  try {
    // Use the Spotify API to remove the track from the playlist
    await spotifyApi.removeTracksFromPlaylist(playlistId, [{ uri: `spotify:track:${trackId}` }]);

    // Update local data (in-memory object)
    const playlist = playlists[req.user.id].find(p => p.id === playlistId);
    if (playlist) {
      // Find the index of the track in the playlist
      const trackIndex = playlist.tracks.findIndex(t => t.track.id === trackId);
      if (trackIndex !== -1) {
        playlist.tracks.splice(trackIndex, 1);
        console.log('Track removed successfully');
      } else {
        console.log('Track not found locally');
      }
    } else {
      console.log('Playlist not found locally');
    }

    // Redirect to the same playlist page with updated track list
    res.redirect(`/playlist/${playlistId}`);
  } catch (error) {
    console.error('Error removing track from Spotify API:', error);
    res.status(500).send('Error removing track');
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


