Cookie = null;
IsChrome = true;

if (navigator.userAgent.indexOf("Chrome") < 0) {
    IsChrome = false;
}

function updateSID(callback, cbArgs) {
    let args = {
        "domain": 'imgur.com'
    };
    // fire fox needs this firstPartyDomain thing
    if (!IsChrome) {
        args['firstPartyDomain'] = 'imgur.com';
    }
    

    let p = browser.cookies.getAll(args)
    .then(function (cookie) {
        _saveCookie(cookie)
        return Cookie.IMGURUIDLOTAME.value; // for when a promise is returned in messaging. bad design? i guess but its not needed in other places?
    });
    // this is a for async sendResponse, because getCookies is async and responding asap will yield old SID
    if (IsChrome && callback) {
        console.log(typeof(callback))
        callback(cbArgs);
    }
    else {
        return p;
    }
}

// make the array to a dict
function _saveCookie(cookie) {
    let o = {};
    for (let x in cookie) {
        o[cookie[x].name] = cookie[x];
    }
    Cookie = o;
}

// initialy read out cookies
updateSID();

// odd bug that using browser polyfill on chrome doesnt find sendresponse
b = browser;
if (IsChrome) {
    b = chrome;
}
b.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ?
            "from a content script:" + sender.tab.url :
            "from the extension: ", request);

        if (request.getSID == true) {
            if (IsChrome) {
                updateSID(sendResponse, Cookie.IMGURUIDLOTAME.value);
                //sendResponse(Cookie.IMGURUIDLOTAME.value);
            }
            else { 
                return updateSID(); // firefox can return a promise instead of sendResponse, where the .then() returns the msg?
            }
        } else {
            if (IsChrome) {
                sendResponse('command not found');
            }
            else {
                return new Promise(r => resolve('command not found'));
            }
        }
    }
);


// intercept XHR metadata on favorites to mark already faved ones
// TODO implement the filter api for firefox instead of replaying the XHR
function chromeListener(details) {
    // if its the replayed XHR (marked by this &afh=1) we need to apply the cookies to make it work in firefox
    // chrome does apply cookies automatically but i guess we can just rewrite them
    if (details.url.indexOf('&afh=1') > -1) {
        let tmp = details.requestHeaders;
        let s = '';
        for (let i in Cookie) {
            s += i + '=' + Cookie[i].value + ';';
        }
        tmp.push({name: 'Cookie', value: s});
        return {requestHeaders: tmp}; // already a replayed request TODO maybe a better way than adding a parameter to URL?
    }
    let xhr = new XMLHttpRequest();
    xhr.open('GET', details.url + '&afh=1');
    xhr.responseType = "json";
    xhr.withCredentials = true;
    xhr.onload = function () {
        if (xhr.response.data.length > 0) {
            let x = [];
            for (let i of xhr.response.data) {
                if (i.favorite) {
                    x.push(i.id)
                }
            }
            console.log('sending message to', details)
            chrome.tabs.sendMessage(details.tabId, {favorites: x}, function(response) {});  
        }
    }
    xhr.send();
    return {};
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    chromeListener, {
        urls: ["*://api.imgur.com/3/account/*/gallery_favorites/*"],
        types: ["xmlhttprequest"]
    }, ["blocking", "requestHeaders"]
);