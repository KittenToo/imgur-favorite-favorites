/*
    TODO: make possible to unfav via the new button (if clicked by mistake)
*/

SID = undefined;
IsChrome = true;

if (navigator.userAgent.indexOf("Chrome") < 0) {
    IsChrome = false;
}

document.body.onload = () => {

    var styleEl = document.createElement('style'),
        styleSheet;
    styleEl.innerText = '.Grid-item-image-fav { position: absolute; left: 15px; top: 15px; border-radius:var(--smallBorderRadius); ' +
        ' color: white; background: var(--voyagerDarkGrey); padding: 2px 7px 1px; font-size: 20pt; cursor: pointer; }' +
        '.Grid-item-image-fav.green { color: green; }' +
        '.Grid-item-image-fav.grey { color: #999; }';

    // Append style element to head
    document.head.appendChild(styleEl);

    let path = document.location.pathname.split("/");
    // init DOM observer
    var observer = new MutationSummary({
        callback: handleDOMMutation,
        queries: [{
            all: true
        }]
    });


    getSID();
}

// listen for list of my favorites from background page
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ?
            "from a content script:" + sender.tab.url :
            "from the extension", request);
        if ('favorites' in request) {
            parseFavList(request.favorites);
            sendResponse({OK:true});
        }
    }
);

function parseFavList(l) {
    for (let x in l) {
        let id =  '#favfav' +l[x];
        let el = document.querySelector(id);
        // if DOM is not build yet (element not found) try again later
        // TODO check if document is loaded already and fav buttons inserted, if not wait for onload event or let favbuton emit something
        if (!el) {
            //console.log('Element not found, retry')
            window.setTimeout(parseFavList, 300, l);
            break;
        }
        addClass(el, 'green');
    }
}

function getSID() {
    // query session ID from background page
    // some odd bug with chrome that the promise doesnt work (message port closed before response received)
    browser.runtime.sendMessage({
        getSID: true
    }).then((e) => {
        //console.log('response: ',e)
        if (e != null) {
            _setSID(e);
            // if SID was retrieved run the first time
            executeScript();
        }
    });
}

function _setSID(s) {
    console.log('got SID ', s);
    SID = s;
}

// on dom change execute the script
// if called by mutation-summary it will also fill in the changed elements, so you dont need to update all
function executeScript(summary) {
    let path = document.location.pathname.split("/");

    if (path[1] == "user" && path[3] == 'favorites') {
        favoritesButton(summary);
    }
}

function handleDOMMutation(summary) {
    executeScript(summary);
}

function favoritesButton(summary) {

    let favs = document.getElementsByClassName('FavoritePost-container');

    // if the mutation observer gives you only the changed elements use them
    if (typeof summary !== 'undefined') {
        if (summary[0].added.length > 0) {
            let tmp = [];
            for (let x of summary[0].added) {
                // TODO find out how to make summary.js filter that
                if (typeof x['classList'] !== 'undefined' && hasClass(x, 'FavoritePost-container'))
                    tmp.push(x)
            }
            favs = tmp;
        }
    }

    for (let x of favs) {
        if (x.getElementsByClassName('Grid-item-image-fav').length > 0) {
            continue; // already injected stuff here, TODO try to make the dom change event only show the new elements
        }
        let c = x.getElementsByClassName('FavoritePost');
        let id = x.getElementsByTagName("a")[0].href.split("/"); // post id
        id = id[id.length - 1];
        let n = document.createElement("div");
        n.setAttribute('class', 'Grid-item-image-fav');
        n.setAttribute('id', 'favfav' + id);
        n.innerHTML = '&hearts;';
        n.onclick = (ev) => {
            getnewSIDbeforeFav(id, n);
        };
        c[0].appendChild(n);
    }
}

// because SID is not updated once it runs out serverside, we will have to query SID before every XHR..
// we have to query the background page to access cookies and retrieve the current SID (IMGURUIDLOTAME)
function getnewSIDbeforeFav(id, el) {
    browser.runtime.sendMessage({
        getSID: true
    }).then((e) => {
        if (e != null) {
            _setSID(e);
            // if SID was retrieved run the first time
            fav(id, el);
        } else {
            console.log('favorite favorites: ERROR cant find session id')
        }
    });
}

function fav(id, el) {
    // favourite example https://imgur.com/a/DjjpGvA/fav.json
    // POST, data = { ajax: true, msid: sessId, location: 'inside' }
    // some posts have a ../a/.. in the url, because i didnt find any clue which one is used for the current favorite
    //  we just try both variants

    let xhr = null;
    if (!IsChrome) {
        xhr = new content.XMLHttpRequest(); // firefox
    } else {
        xhr = new XMLHttpRequest(); // chrome
    }
    xhr.open('POST', 'https://imgur.com/' + id + '/fav.json')
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.responseType = 'json';
    let data = 'ajax=true' +
        '&msid=' + SID +
        '&location=inside';
    xhr.send(data);

    xhr.onerror = function (e) {
        console.log('favorite favorites: errer', e);
    }
    //retry with other URL if it failed, or if we unfaved it by mistake
    xhr.onload = function () {
        if (xhr.status == 404) {
            let xhr2 = null;
            if (!IsChrome) {
                xhr2 = new content.XMLHttpRequest();
            } else {
                xhr2 = new XMLHttpRequest();
            }
            xhr2.open('POST', 'https://imgur.com/a/' + id + '/fav.json')
            xhr2.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr2.responseType = 'json';
            var data = 'ajax=true' +
                '&msid=' + SID +
                '&location=inside';
            xhr2.send(data);
            xhr2.onload = function () {
                checkIfUnfavorited('https://imgur.com/a/' + id + '/fav.json', xhr2.response, el);
            }
        } else {
            checkIfUnfavorited('https://imgur.com/' + id + '/fav.json', xhr.response, el)
        }
    };
}

// sending the request toggles the favorite state. so if we unfaved by mistake just fav it again
// recurse set true if it was called recursevily to avoid infite loop
function checkIfUnfavorited(url, response, el, recurse) {
    let fmethod = response.data.fav_method;
    if (fmethod == 'unfavorited') {
        let xhr = null;
        if (!IsChrome) {
            xhr = new content.XMLHttpRequest();
        } else {
            xhr = new XMLHttpRequest();
        }
        xhr.open('POST', url);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.responseType = 'json';
        let data = 'ajax=true' +
            '&msid=' + SID +
            '&location=inside';

        xhr.send(data);
        xhr.onload = function () { 
            if (!recurse) {
                checkIfUnfavorited(url, xhr.response, el, true);
            }
        };
    } else if (['favorited', 'confirm'].indexOf(fmethod) >= 0) {
        addClass(el, 'green');
    } else {
        addClass(el, 'grey'); // something went wrong
    }
}



// helper stuff

function hasClass(el, className) {
    if (el.hasOwnProperty('classList'))
        return el.classList.contains(className)
    else
        return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'))
}

function addClass(el, className) {
    if (el.classList)
        el.classList.add(className)
    else if (!hasClass(el, className)) el.className += " " + className
}

function removeClass(el, className) {
    if (el.classList)
        el.classList.remove(className)
    else if (hasClass(el, className)) {
        var reg = new RegExp('(\\s|^)' + className + '(\\s|$)')
        el.className = el.className.replace(reg, ' ')
    }
}