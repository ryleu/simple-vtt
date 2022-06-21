/*
This file is part of simple-vtt.

simple-vtt is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version.

simple-vtt is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the GNU Affero General Public License along with simple-vtt. If not, see
<https://www.gnu.org/licenses/>.
*/

let inputBox = document.getElementById("code-input");

inputBox.disabled = true;
inputBox.value = "";


function onJoinButton() {
    if (inputBox.disabled) {
        inputBox.disabled = false;
    } else {
        document.location.href = `/board/?id=${inputBox.value}`;
    }
}

function onNewButton() {
    fetch("/api/new", {method: "POST"}).then((value) => {
        value.json().then((json) => {
            document.location.href = `/board/?id=${json.invite}`;
        });
    });
}
