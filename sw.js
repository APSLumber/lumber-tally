// Lets the app open with no signal. Data is shared through Supabase (with a copy kept on each device); this only stores the app's own files.
var CACHE = 'tally-v3';
var CORE = ['./', 'material.html', 'supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var LIBRARY_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
var SLOW_MS = 3000;

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// App files: use the latest from the web so updates arrive right away, but fall back to the saved copy
// when there is no signal, or after a few seconds of weak signal out in the yard.
function latestFirst(req){
  return caches.open(CACHE).then(function(cache){
    var saved = function(){
      return cache.match(req, {ignoreSearch:true}).then(function(hit){
        return hit || (req.mode==='navigate' ? cache.match('./') : undefined);
      });
    };
    var fresh = fetch(req).then(function(res){
      if(res.ok) cache.put(req, res.clone());
      return res;
    });
    return new Promise(function(resolve, reject){
      var timer = setTimeout(function(){
        saved().then(function(hit){ if(hit) resolve(hit); });
      }, SLOW_MS);
      fresh.then(function(res){ clearTimeout(timer); resolve(res); }, function(err){
        clearTimeout(timer);
        saved().then(function(hit){ hit ? resolve(hit) : reject(err); });
      });
    });
  });
}

// Fonts and the PDF/Excel readers never change at a given address, so a saved copy is always good.
function savedFirst(req){
  return caches.open(CACHE).then(function(cache){
    return cache.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res.ok || res.type==='opaque') cache.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  var url = new URL(e.request.url);
  if(url.origin===self.location.origin) e.respondWith(latestFirst(e.request));
  else if(LIBRARY_HOSTS.indexOf(url.hostname)>-1) e.respondWith(savedFirst(e.request));
});
