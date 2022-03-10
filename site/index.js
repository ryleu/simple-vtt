let inputBox = document.getElementById("code-input");

inputBox.disabled = true;
inputBox.value = "";


function onJoinButton(event) {
  if (inputBox.disabled) {
    inputBox.disabled = false;
  } else {
    document.location.href = `/board/?id=${inputBox.value}`;
  }
}

function onNewButton(event) {
  fetch("/api/new", {method: "POST"}).then((value) => {
    value.json().then((json) => {
      document.location.href = `/board/?id=${json.invite}`;
    });
  });
}
