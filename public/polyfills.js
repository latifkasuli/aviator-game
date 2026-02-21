(function(){ 
  'use strict';
  
  if (typeof Promise === 'undefined') { 
    console.warn('Promise not supported - loading lightweight polyfill');
    window.Promise = function(fn) {
      var state = 'pending', value, handlers = [];
      function resolve(result) {
        if (state === 'pending') { state = 'fulfilled'; value = result; handlers.forEach(handle); handlers = null; }
      }
      function reject(error) {
        if (state === 'pending') { state = 'rejected'; value = error; handlers.forEach(handle); handlers = null; }
      }
      function handle(handler) {
        if (state === 'pending') handlers.push(handler);
        else if (state === 'fulfilled' && handler.onFulfilled) handler.onFulfilled(value);
        else if (state === 'rejected' && handler.onRejected) handler.onRejected(value);
      }
      this.then = function(onFulfilled, onRejected) {
        return new Promise(function(resolve, reject) {
          handle({ 
            onFulfilled: function(result) { try { resolve(onFulfilled ? onFulfilled(result) : result); } catch(ex) { reject(ex); } },
            onRejected: function(error) { try { resolve(onRejected ? onRejected(error) : error); } catch(ex) { reject(ex); } }
          });
        });
      };
      fn(resolve, reject);
    };
  }

  if (!window.fetch) {
    window.fetch = function(url, opts) {
      return new Promise(function(resolve, reject){
        try{
          var xhr = new XMLHttpRequest();
          xhr.open((opts && opts.method) || 'GET', url, true);
          xhr.onload = function(){
            var headers = xhr.getAllResponseHeaders();
            resolve({
              ok: (xhr.status>=200 && xhr.status<300),
              status: xhr.status,
              json: function() { return Promise.resolve(JSON.parse(xhr.responseText || 'null')); },
              text: function() { return Promise.resolve(xhr.responseText || ''); },
              headers: { get: function(k) { return (headers.match(new RegExp('^'+k+':\\s*(.*)$','mi'))||[])[1]; } }
            });
          };
          xhr.onerror = reject;
          if (opts && opts.headers) {
            for (var k in opts.headers) xhr.setRequestHeader(k, opts.headers[k]);
          }
          xhr.send((opts && opts.body) || null);
        }catch(e){ reject(e); }
      });
    };
  }

  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null to object');
      target = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src != null) for (var key in src) if (Object.prototype.hasOwnProperty.call(src, key)) target[key] = src[key];
      }
      return target;
    };
  }

  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function(predicate) {
        if (this == null) throw new TypeError('"this" is null or not defined');
        if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
        var list = Object(this), length = list.length >>> 0, thisArg = arguments[1], value;
        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) return value;
        }
        return undefined;
      }
    });
  }

  if (!navigator.clipboard) {
    window.copyText = function (text) {
      var el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(el); }
    };
  }

  if (!window.console) {
    window.console = { log: function(){}, warn: function(){}, error: function(){}, info: function(){} };
  }

  if (!navigator.vibrate) {
    navigator.vibrate = function() { return false; };
  }

})();
