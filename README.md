# imgur-favorite-favorites
browser extensions which allows to favorite other users favorites easily from the overview.
it works only to ADD favs, you cant unfav them yet.

# usage in chrome
im not gonna pay google $5 so i can publish something to the chrome store, so you will have to turn on developer mode and download the sourcecode folder and add it as unpacked extension.
* Click 'Clone or Download' and 'Download ZIP'
* unpack it somewhere into a folder (no idea where you keep ur stuff ;D)
* Go to the extension page (chrome://extensions/) and in the top right enable developer mode.
* click 'load unpacked extension' and point it to the folder you just created
* it should work now, reload the imgur site.

# permissions
* cookies: it needs to access your imgur cookie so it can get the session id.
* webRequest: it needs to replay the XHR meta-info request, so it can know which posts you already have favorited.
