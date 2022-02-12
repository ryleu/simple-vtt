const ws = new WebSocket('ws://127.0.0.1:8081');

// Browser WebSockets have slightly different syntax than `ws`.
// Instead of EventEmitter syntax `on('open')`, you assign a callback
// to the `onopen` property.
ws.onopen = function() {
  document.querySelector('#send').disabled = false;

  document.querySelector('#send').addEventListener('click', function() {
    ws.send(document.querySelector('#message').value);
  });
};

ws.onmessage = function(msg) {
  document.querySelector('#messages').innerHTML += `<div>${msg.data}</div>`;
};
