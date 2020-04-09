let myImage = document.querySelector('img')
let myButton = document.querySelector('button');
let myHeading = document.querySelector('h1');

myImage.onclick = function () {
    let mySrc = myImage.getAttribute('src');
    if (mySrc === '../static/images/Rengar-Mini-Icon.jpg') {
        myImage.setAttribute('src', '../static/images/Rengar-Small.jpg');
    } else {
        myImage.setAttribute('src', '../static/images/Rengar-Mini-Icon.jpg');
    }
}

function setUserName() {
    let myName = prompt('Please enter your name.');
    if (!myName || myName === null) {
        setUserName();
    } else {
        localStorage.setItem('name', myName);
        myHeading.textContent = 'Rengar is cool, ' + myName;
    }
}

if (!localStorage.getItem('name')) {
    setUserName();
} else {
    let storedName = localStorage.getItem('name');
    myHeading.textContent = 'Rengar is cool, ' + storedName;
}

myButton.onclick = function () {
    setUserName();
}