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
	
	const metainfo = {
		version: 56,
		uncompressedSize: 29650112
	};
	
	const worker = await (async function() {
		try {
			const worker = new Worker("accentjiten.worker.js");
			const arrayBuffer = await cacheURLInLocalStorage("accentjiten.dat.lzma", metainfo.version);
			worker.addEventListener("message", handleWorkerMessage);
			worker.postMessage(
				{name: "load", arrayBuffer: arrayBuffer, uncompressedSize: metainfo.uncompressedSize},
				[arrayBuffer]);
			return worker;
		} catch (error) {
			loadingMsg.innerHTML = "Error";
			throw error;
		}
	})();
	
	function handleWorkerMessage(event) {
		const data = event.data;
		
		switch (data.name) {
			
			case "loadsuccess": {
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
			
			case "loaderror": {
				loadingMsg.innerHTML = "Error";
				break;
			}
			
			case "searchsuccess": {
				desc.innerHTML = data.html1;
				searchResults.innerHTML = data.html2;
				break;
			}
			
		}
		
	}
	
	async function cacheURLInLocalStorage(url, version) {
		const cacheKey = url + "|" + "cache";
		const versionKey = url + "|" + "version";
		
		if (localStorage.getItem(versionKey) === version.toString()) {
			const arrayBuffer = await getArrayBufferFromLocalStorage(cacheKey);
			if (!arrayBuffer) { throw new Error(); }
			console.log("Read " + url + " version " + version + " from localStorage");
			return arrayBuffer;
		} else {
			const arrayBuffer = (await (await fetch(url)).arrayBuffer());
			if (!arrayBuffer) { throw new Error(); }
			let success = true;
			try {
				await setArrayBufferToLocalStorage(arrayBuffer, cacheKey);
				localStorage.setItem(versionKey, version.toString());
			} catch (error) {
				success = false;
			}
			if (success) {
				console.log("Downloaded " + url + " version " + version + " and cached to localStorage");
			} else {
				console.log("Downloaded " + url + " version " + version + ", failed to cache to localStorage");
			}
			return arrayBuffer;
		}
		
		async function getArrayBufferFromLocalStorage(key) {
			const base64Url = localStorage.getItem(key);
			return (await (await fetch(base64Url)).arrayBuffer());
		}
		
		async function setArrayBufferToLocalStorage(arrayBuffer, key) {
			const base64Url = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result);
				reader.readAsDataURL(new Blob([arrayBuffer]));
			});
			localStorage.setItem(key, base64Url);
		}
		
	}
	
}