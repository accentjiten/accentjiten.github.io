/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

*/

init().then(
	() => { },
	(error) => {
		throw error;
	}
);

async function init() {
	"use strict";
	
	const input = document.createElement("input");
	input.type = "text";
	input.style.fontSize = "20px";
	
	const loadingMsg = document.createElement("p");
	loadingMsg.innerHTML = "Loading...";
	document.body.appendChild(loadingMsg);
	
	const desc = document.createElement("p");
	desc.innerHTML = "日本語アクセント辞典<br>使い方：入力で単語を検索する<br><br>" +
		"Real-time Japanese pitch accent dictionary<br>(How to use: search a word<br>Try typing \"konnichiwa\")";
	
	const searchResults = document.createElement("p");
	
	const worker = new Worker("accentjiten.worker.js");
	
	const metainfo = {
		version: 37,
		uncompressedSize: 16600160
	};
	
	const arrayBuffer = await new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";
		xhr.addEventListener("loadend", (event) => {
			if (xhr.status >= 200 && xhr.status <= 299) {
				resolve(xhr.response);
			} else {
				reject(new Error());
			}
		});
		xhr.open("GET", "accentjiten.dat.lzma");
		xhr.send();
	});
	
	worker.addEventListener("message", handleWorkerMessage);
	
	worker.postMessage(
		{name: "load", arrayBuffer: arrayBuffer, uncompressedSize: metainfo.uncompressedSize}, [arrayBuffer]);
	
	function handleWorkerMessage(event) {
		const data = event.data;
		
		switch (data.name) {
			case "onload": {
				const title = document.createElement("p");
				title.innerHTML = "accentjiten [alpha]";
				document.body.removeChild(loadingMsg);
				document.body.appendChild(title);
				document.body.appendChild(input);
				document.body.appendChild(desc);
				document.body.appendChild(searchResults);
				input.addEventListener("input", (event) => {
					const query = input.value;
					worker.postMessage({name: "search", query: query});
				});
				input.focus();
				break;
			}
			case "onsearch": {
				desc.innerHTML = data.html1;
				searchResults.innerHTML = data.html2;
				break;
			}
		}
		
	}
	
}