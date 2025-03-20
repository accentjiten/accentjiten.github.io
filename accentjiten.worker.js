/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024-2025 accentjiten

*/

onmessage = (event) => {
	"use strict";
	
	const data = event.data;
	switch (data.name) {
		
		case "loadstart": {
			try {
				AccentJiten.load().then(
					() => {
						postMessage({name: "loadsuccess"});
					},
					(error) => {
						console.error(error);
						postMessage({name: "loaderror"});
					}
				);
			} catch (error) {
				console.error(error);
				postMessage({name: "loaderror"});
			}
			break;
		}
		
		case "searchstart": {
			const query = data.query;
			const searchID = data.searchID;
			const results = AccentJiten.resetSearchCoroutine(query, searchID);
			postMessage({name: "searchresults", results: results});
			break;
		}
		
		case "searchcontinue": {
			const results = AccentJiten.continueSearchCoroutine();
			postMessage({name: "searchresults", results: results});
			break;
		}
		
	}
};

var AccentJiten = (() => {
	"use strict";
	
	class AJ {
		
		async load() {
			if (this.initialized) throw new Error();
			
			const fileInfo = {
				url: "accentjiten-98.dat.lzma",
				keyName: "accentjiten.dat.lzma",
				version: "98",
				uncompressedSize: 22166845
			};
			
			const arrayBuffer = await (async function() {
				const lzmaArrayBuffer = await AJ.cacheURL(fileInfo.url, fileInfo.keyName, fileInfo.version);
				const ret = new ArrayBuffer(fileInfo.uncompressedSize);
				const inUint8Array = new Uint8Array(lzmaArrayBuffer);
				const outUint8Array = new Uint8Array(ret);
				let inOffset = 0;
				let outOffset = 0;
				const inStream = { readByte: () => inUint8Array[inOffset++] };
				const outStream = { writeByte: (byte) => { outUint8Array[outOffset++] = byte; } };
				LZMA.decompressFile(inStream, outStream);
				return ret;
			})();
			
			this.data = new DataView(arrayBuffer);
			this.initialize();
			this.initialized = true;
		}
		
		initialize() {
			const data = this.data;
			const entryArrayLength = AJ.entryArray_getLength(data);
			const syllableFormPoolOffset = 4 + (entryArrayLength * 4 * 4);
			
			let pos = syllableFormPoolOffset;
			
			const nSyllableFormPool = AJ.getUint16At(data, pos);
			pos += 2;
			const syllableFormPool = new Array(nSyllableFormPool);
			for (let i = 0; i < nSyllableFormPool; i++) {
				const nHiraganaMoras = AJ.getUint8At(data, pos);
				pos += 1;
				const hiraganaMoras = new Array(nHiraganaMoras);
				for (let j = 0; j < nHiraganaMoras; j++) {
					hiraganaMoras[j] = AJ.getStringAt(data, pos);
					pos += 1 + (hiraganaMoras[j].length * 2);
				}
				
				const nKatakanaMoras = AJ.getUint8At(data, pos);
				pos += 1;
				const katakanaMoras = new Array(nKatakanaMoras);
				for (let j = 0; j < nKatakanaMoras; j++) {
					katakanaMoras[j] = AJ.getStringAt(data, pos);
					pos += 1 + (katakanaMoras[j].length * 2);
				}
				
				const nRomaji = AJ.getUint8At(data, pos);
				pos += 1;
				const romaji = new Array(nRomaji);
				for (let j = 0; j < nRomaji; j++) {
					romaji[j] = AJ.getStringAt(data, pos);
					pos += 1 + (romaji[j].length * 2);
				}
				
				const isPunctuationValue = AJ.getUint8At(data, pos);
				pos += 1;
				const isPunctuation = isPunctuationValue ? true : false;
				
				syllableFormPool[i] = { hiraganaMoras: hiraganaMoras, katakanaMoras: katakanaMoras, romaji: romaji,
					hiraganaSyllable: hiraganaMoras.join(""), katakanaSyllable: katakanaMoras.join(""),
					poolIndex: i, isPunctuation: isPunctuation };
			}
			
			const nSyllablePool = AJ.getUint16At(data, pos);
			pos += 2;
			const syllablePool = new Array(nSyllablePool);
			for (let i = 0; i < nSyllablePool; i++) {
				const syllableFormPoolIndex = AJ.getUint16At(data, pos);
				pos += 2;
				const syllableForm = syllableFormPool[syllableFormPoolIndex];
				const hiraganaOrKatakana = AJ.getUint8At(data, pos);
				pos += 1;
				const syllable = { form: syllableForm, hiraganaOrKatakana: hiraganaOrKatakana, poolIndex: i };
				syllablePool[i] = syllable;
			}
			
			this.syllableFormPool = syllableFormPool;
			this.syllablePool = syllablePool;
			this.exactMatchesArr = new Uint32Array(entryArrayLength);
			this.nonExactMatchesArr = new Uint32Array(entryArrayLength);
		}
		
		static async cacheURL(url, keyName, version) {
			try {
				const dbVersion = await dbGet("version");
				if (dbVersion === version) {
					const arrayBuffer = await dbGet(keyName + "buf");
					console.log("Loaded " + keyName + " version " + version + " from cache");
					return arrayBuffer;
				} else {
					const arrayBuffer = await downloadURL(url);
					await dbReset({[keyName + "buf"]: arrayBuffer, "version": version});
					if (dbVersion) {
						console.log(
							"Downloaded and cached " + keyName + " from version " + dbVersion + " to " + version);
					} else {
						console.log("Downloaded and cached " + keyName + " version " + version);
					}
					return arrayBuffer;
				}
			} catch (error) {
				console.error(error);
				return await downloadURL(url);
			}
			
			async function dbGet(key) {
				return await new Promise((resolve, reject) => {
					const dbRequest = indexedDB.open("aj");
					dbRequest.onerror = (error) => {
						reject(error);
					};
					dbRequest.onsuccess = (event) => {
						const db = event.target.result;
						if (!db.objectStoreNames.contains("aj")) {
							db.close();
							resolve(null);
						} else {
							const valueRequest = db.transaction(["aj"]).objectStore("aj").get(key);
							valueRequest.onerror = (error) => { reject(error); };
							valueRequest.onsuccess = (event) => { 
								const result = event.target.result;
								db.close();
								resolve(result);
							};
						}
					};
				});
			}
			
			async function dbReset(values) {
				await new Promise((resolve, reject) => {
					const request = indexedDB.deleteDatabase("aj");
					request.onerror = (error) => { reject(error); };
					request.onsuccess = (event) => { resolve(); };
				});
				await new Promise((resolve, reject) => {
					const request = indexedDB.open("aj");
					request.onerror = (error) => { reject(error); };
					request.onupgradeneeded = (event) => {
						const db = event.target.result;
						const objectStore = db.createObjectStore("aj");
						for (const key in values) {
							objectStore.put(values[key], key);
						}
						db.close();
						resolve();
					};
				});
			}
			
			async function downloadURL(url) {
				const response = await fetch(url);
				if (!response) throw new Error();
				const ret = await response.arrayBuffer();
				if (!ret) throw new Error();
				return ret;
			}
			
		}
		
		static NO_MATCH = 0;
		static EXACT_MATCH = 1;
		static NON_EXACT_MATCH = 2;
		
		resetSearchCoroutine(query, searchID) {
			const data = this.data;
			this.query = query;
			this.searchID = searchID;
			this.syllableTrie = AJ.createSyllableTrie(this.syllableFormPool, query);
			this.searchIndex = 0;
			this.searching = true;
			this.exactMatchIndex = 0;
			this.nonExactMatchIndex = 0;
			this.nExactMatches = 0;
			this.nNonExactMatches = 0;
			return { searchID: searchID };
		}
		
		continueSearchCoroutine() {
			if (this.searching) {
				const data = this.data;
				const syllablePool = this.syllablePool;
				const query = this.query;
				const syllableTrie = this.syllableTrie;
				const exactMatchesArr = this.exactMatchesArr;
				const nonExactMatchesArr = this.nonExactMatchesArr;
				let nExactMatches = this.nExactMatches;
				let nNonExactMatches = this.nNonExactMatches;
				const entryArrayLength = AJ.entryArray_getLength(data);
				const nMaxIter = 1000;
				
				const fromIndex = this.searchIndex;
				const toIndex = Math.min(fromIndex + nMaxIter, entryArrayLength);
				let i = fromIndex;
				for ( ; i < toIndex; i++) {
					const entryOffset = AJ.entryArray_getEntry_entryOffset(data, i);
					const match1 = AJ.matchWordVariants(data, entryOffset, query);
					if (match1 === AJ.EXACT_MATCH) {
						exactMatchesArr[nExactMatches++] = entryOffset;
					} else {
						const match2 = AJ.matchSyllables(data, syllablePool, entryOffset, syllableTrie);
						switch (match2) {
							case AJ.NO_MATCH:
								if (match1 === AJ.NON_EXACT_MATCH) {
									nonExactMatchesArr[nNonExactMatches++] = entryOffset;
								}
								break;
							case AJ.NON_EXACT_MATCH:
								nonExactMatchesArr[nNonExactMatches++] = entryOffset;
								break;
							case AJ.EXACT_MATCH:
								exactMatchesArr[nExactMatches++] = entryOffset;
								break;
						}
					}
				}
				this.searchIndex = i;
				this.nExactMatches = nExactMatches;
				this.nNonExactMatches = nNonExactMatches;
				
				if (i === entryArrayLength) {
					this.searching = false;
				}
				return { searchID: this.searchID };
			} else {
				const data = this.data;
				const syllablePool = this.syllablePool;
				const exactMatchesArr = this.exactMatchesArr;
				const nonExactMatchesArr = this.nonExactMatchesArr;
				const nExactMatches = this.nExactMatches;
				const nNonExactMatches = this.nNonExactMatches;
				const nMaxResults = 20;
				const results = [];
				let exactMatchIndex = this.exactMatchIndex;
				let nonExactMatchIndex = this.nonExactMatchIndex;
				
				{
					const toIndex = Math.min(exactMatchIndex + nMaxResults - results.length, nExactMatches);
					for ( ; exactMatchIndex < toIndex; exactMatchIndex++) {
						const entryOffset = exactMatchesArr[exactMatchIndex];
						results.push(AJ.entry_toObject(data, syllablePool, entryOffset));
					}
					this.exactMatchIndex = exactMatchIndex;
				}
				
				{
					const toIndex = Math.min(nonExactMatchIndex + nMaxResults - results.length, nNonExactMatches);
					for ( ; nonExactMatchIndex < toIndex; nonExactMatchIndex++) {
						const entryOffset = nonExactMatchesArr[nonExactMatchIndex];
						results.push(AJ.entry_toObject(data, syllablePool, entryOffset));
					}
					this.nonExactMatchIndex = nonExactMatchIndex;
				}
				
				return {
					searchID: this.searchID,
					end: exactMatchIndex === nExactMatches && nonExactMatchIndex === nNonExactMatches,
					nTotalResults: nExactMatches + nNonExactMatches,
					entries: results
				};
			}
		}
		
		static entry_toObject(data, syllablePool, entryOffset) {
			const stringArrayOffset = AJ.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, 0);
			const word = AJ.string_get(data, stringOffset);
			const pronunciationArrayOffset = AJ.entry_getPronunciations_pronunciationArrayOffset(data, entryOffset);
			const pronunciations = AJ.pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset);
			const conjugationsOffset = AJ.entry_getConjugations_pronunciationArrayArrayOffset(data, entryOffset);
			const conjugations = AJ.pronunciationArrayArray_toObject(data, syllablePool, conjugationsOffset);
			const result = { word: word, pronunciations: pronunciations };
			if (conjugations.length > 0) {
				result.conjugations = conjugations;
			}
			return result;
		}
		
		static pronunciationArrayArray_toObject(data, syllablePool, pronunciationArrayArrayOffset) {
			const pronunciationArrayArrayLength =
				AJ.pronunciationArrayArray_getLength(data, pronunciationArrayArrayOffset);
			const array = new Array(pronunciationArrayArrayLength);
			for (let i = 0; i < pronunciationArrayArrayLength; i++) {
				const pronunciationArrayOffset =
					AJ.pronunciationArrayArray_getPronunciationArray_pronunciationArrayOffset(
						data, pronunciationArrayArrayOffset, i);
				const pronunciationArray =
					AJ.pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset);
				array[i] = pronunciationArray;
			}
			return array;
		}
		
		static pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset) {
			const pronunciationArrayLength = AJ.pronunciationArray_getLength(data, pronunciationArrayOffset);
			const array = new Array(pronunciationArrayLength);
			for (let i = 0; i < pronunciationArrayLength; i++) {
				const pronunciationOffset =
					AJ.pronunciationArray_getPronunciation_pronunciationOffset(data, pronunciationArrayOffset, i);
				const pronunciation = AJ.pronunciation_toObject(data, syllablePool, pronunciationOffset);
				array[i] = pronunciation;
			}
			return array;
		}
		
		static pronunciation_toObject(data, syllablePool, pronunciationOffset) {
			const syllableArrayOffset = AJ.pronunciation_getReading_syllableArrayOffset(data, pronunciationOffset);
			const syllableArray = AJ.syllableArray_toObject(data, syllablePool, syllableArrayOffset);
			const stringOffset = AJ.pronunciation_getAccent_stringOffset(data, pronunciationOffset);
			const accent = AJ.string_get(data, stringOffset);
			const sourceArrayOffset = AJ.pronunciation_getSources_sourceArrayOffset(data, pronunciationOffset);
			const sources = AJ.sourceArray_toObject(data, sourceArrayOffset);
			const result = {
				accent: accent,
				kana: syllableArray.map(x => x.value).join(""),
				tokenizedKana: syllableArray
			};
			if (sources.length > 0) {
				result.sources = sources;
			}
			return result;
		}
		
		static syllableArray_toObject(data, syllablePool, syllableArrayOffset) {
			const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
			const array = [];
			for (let i = 0; i < syllableArrayLength; i++) {
				const syllablePoolIndex =
					AJ.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, i);
				const syllable = syllablePool[syllablePoolIndex];
				const syllableForm = syllable.form;
				const moras = !syllable.hiraganaOrKatakana ? syllableForm.hiraganaMoras : syllableForm.katakanaMoras;
				const isPunctuation = syllableForm.isPunctuation;
				for (const mora of moras) {
					array.push({type: isPunctuation ? "yakumono" : "mora", value: mora});
				}
			}
			return array;
		}
		
		static sourceArray_toObject(data, sourceArrayOffset) {
			const sourceArrayLength = AJ.sourceArray_getLength(data, sourceArrayOffset);
			const array = new Array(sourceArrayLength);
			for (let i = 0; i < sourceArrayLength; i++) {
				const source = AJ.sourceArray_getSource(data, sourceArrayOffset, i);
				switch (source) {
					case 0: array[i] = "AccentJiten"; break;
					case 1: array[i] = "OJAD"; break;
					case 2: array[i] = "Wiktionary"; break;
					case 3: array[i] = "NHK"; break;
					case 4: array[i] = "Wadoku"; break;
					case 5: array[i] = "Kanjium"; break;
					case 6: array[i] = "Kishimoto Tsuneyo"; break;
				}
			}
			return array;
		}
		
		static matchWordVariants(data, entryOffset, query) {
			const stringArrayOffset = AJ.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringArrayLength = AJ.stringArray_getLength(data, stringArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < stringArrayLength; i++) {
				const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, i);
				const match = AJ.matchWordVariant(data, stringOffset, query);
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static matchWordVariant(data, stringOffset, query) {
			const stringLength = AJ.string_getLength(data, stringOffset);
			const queryLength = query.length;
			for (let i = 0; i < queryLength; i++) {
				if (i >= stringLength) return null;
				const stringCharCode = AJ.string_getCharCode(data, stringOffset, i);
				const queryCharCode = query.charCodeAt(i);
				if (stringCharCode !== queryCharCode) return AJ.NO_MATCH;
			}
			return stringLength === queryLength ? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
		}
		
		static createSyllableTrie(syllableFormPool, query) {
			const formattedQuery = query.replace(/\s/g, "").toUpperCase();
			
			const nodes = new Array(formattedQuery.length);
			for (let i = 0; i < formattedQuery.length; i++)
				nodes[i] = { children: { }, isLeaf: false, isCompleteMatchLeaf: false };
			
			for (let i = 0; i < formattedQuery.length; i++) {
				const node = nodes[i];
				const nodeChildren = node.children;
				for (let j = 0; j < syllableFormPool.length; j++) {
					const syllableForm = syllableFormPool[j];
					const childNodes = new Set();
					for (const substring of syllableForm.romaji) {
						const substringMatch = AJ.matchSubstring(formattedQuery, i, substring);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const hiraganaSyllable = syllableForm.hiraganaSyllable;
						const substringMatch = AJ.matchSubstring(formattedQuery, i, hiraganaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const katakanaSyllable = syllableForm.katakanaSyllable;
						const substringMatch = AJ.matchSubstring(formattedQuery, i, katakanaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					if (childNodes.size > 0) {
						nodeChildren[j] = childNodes;
					}
				}
			}
			
			return nodes;
		}
		
		static matchSubstring(query, index, substring) {
			for (let i = 0; i < substring.length; i++) {
				if (index + i >= query.length) return { nMatchedChars: i, isCompleteMatch: false };
				if (query.charAt(index + i) !== substring.charAt(i)) return null;
			}
			return { nMatchedChars: substring.length, isCompleteMatch: true };
		}
		
		static matchSyllables(data, syllablePool, entryOffset, syllableTrie) {
			const nodes = syllableTrie;
			if (nodes.length === 0) return AJ.NO_MATCH;
			const syllableArrayArrayOffset = AJ.entry_getReadings_syllableArrayArrayOffset(data, entryOffset);
			const syllableArrayArrayLength = AJ.syllableArrayArray_getLength(data, syllableArrayArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < syllableArrayArrayLength; i++) {
				const syllableArrayOffset =
					AJ.syllableArrayArray_getSyllableArray_syllableArrayOffset(data, syllableArrayArrayOffset, i);
				const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
				const match = AJ.matchSyllablesRecursive(
					data, syllablePool, nodes[0], syllableArrayOffset, 0, syllableArrayLength);
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static matchSyllablesRecursive(data, syllablePool, node,
					syllableArrayOffset, syllableArrayIndex, syllableArrayLength) {
			if (syllableArrayIndex >= syllableArrayLength) {
				return AJ.NO_MATCH;
			}
			const syllablePoolIndex =
				AJ.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, syllableArrayIndex);
			const syllable = syllablePool[syllablePoolIndex];
			const childNodes = node.children[syllable.form.poolIndex];
			if (!childNodes) {
				return AJ.NO_MATCH;
			}
			let anyNonExactMatch = false;
			for (const childNode of childNodes) {
				const match = !childNode.isLeaf
					? AJ.matchSyllablesRecursive(data, syllablePool, childNode, syllableArrayOffset,
						syllableArrayIndex + 1, syllableArrayLength)
					: childNode.isCompleteMatchLeaf && syllableArrayIndex === syllableArrayLength - 1
						? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static getUint8At(dataView, pos) {
			return dataView.getUint8(pos);
		}
		
		static getUint16At(dataView, pos) {
			return dataView.getUint16(pos);
		}
		
		static getUint32At(dataView, pos) {
			return dataView.getUint32(pos);
		}
		
		static getStringAt(dataView, pos) {
			const len = dataView.getUint8(pos);
			const chars = new Array(len);
			for (let i = 0; i < len; i++) {
				const charCode = dataView.getUint16((pos + 1) + (i * 2));
				chars[i] = String.fromCharCode(charCode);
			}
			return chars.join("");
		}
		
		static entryArray_getLength(dataView) {
			return AJ.getUint32At(dataView, 0);
		}
		
		static entryArray_getEntry_entryOffset(dataView, index) {
			return 4 + (index * 4 * 4);
		}
		
		static entry_getWordVariants_stringArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset);
		}
		
		static entry_getReadings_syllableArrayArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 4);
		}
		
		static entry_getPronunciations_pronunciationArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 8);
		}
		
		static entry_getConjugations_pronunciationArrayArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 12);
		}
		
		static stringArray_getLength(dataView, stringArrayOffset) {
			return AJ.getUint8At(dataView, stringArrayOffset);
		}
		
		static stringArray_getString_stringOffset(dataView, stringArrayOffset, index) {
			return AJ.getUint32At(dataView, (stringArrayOffset + 1) + (index * 4));
		}
		
		static string_get(dataView, stringOffset) {
			return AJ.getStringAt(dataView, stringOffset);
		}
		
		static string_getLength(dataView, stringOffset) {
			return AJ.getUint8At(dataView, stringOffset);
		}
		
		static string_getCharCode(dataView, stringOffset, index) {
			return AJ.getUint16At(dataView, (stringOffset + 1) + (index * 2));
		}
		
		static syllableArrayArray_getLength(dataView, syllableArrayArrayOffset) {
			return AJ.getUint8At(dataView, syllableArrayArrayOffset);
		}
		
		static syllableArrayArray_getSyllableArray_syllableArrayOffset(dataView, syllableArrayArrayOffset, index) {
			return AJ.getUint32At(dataView, (syllableArrayArrayOffset + 1) + (index * 4));
		}
		
		static syllableArray_getLength(dataView, syllableArrayOffset) {
			return AJ.getUint8At(dataView, syllableArrayOffset);
		}
		
		static syllableArray_getSyllable_syllablePoolIndex(dataView, syllableArrayOffset, index) {
			return AJ.getUint16At(dataView, (syllableArrayOffset + 1) + (index * 2));
		}
		
		static pronunciationArrayArray_getLength(dataView, pronunciationArrayArrayOffset) {
			return AJ.getUint8At(dataView, pronunciationArrayArrayOffset);
		}
		
		static pronunciationArrayArray_getPronunciationArray_pronunciationArrayOffset(
				dataView, pronunciationArrayArrayOffset, index) {
			return AJ.getUint32At(dataView, (pronunciationArrayArrayOffset + 1) + (index * 4));
		}
		
		static pronunciationArray_getLength(dataView, pronunciationArrayOffset) {
			return AJ.getUint8At(dataView, pronunciationArrayOffset);
		}
		
		static pronunciationArray_getPronunciation_pronunciationOffset(dataView, pronunciationArrayOffset, index) {
			return AJ.getUint32At(dataView, (pronunciationArrayOffset + 1) + (index * 4));
		}
		
		static pronunciation_getReading_syllableArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset);
		}
		
		static pronunciation_getAccent_stringOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset + 4);
		}
		
		static pronunciation_getSources_sourceArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset + 8);
		}
		
		static sourceArray_getLength(dataView, sourceArrayOffset) {
			return AJ.getUint8At(dataView, sourceArrayOffset);
		}
		
		static sourceArray_getSource(dataView, sourceArrayOffset, index) {
			return AJ.getUint8At(dataView, (sourceArrayOffset + 1) + (index));
		}
		
	}
	
	const aj = new AJ();
	return {
		load: async function() { await aj.load(); },
		resetSearchCoroutine: function(query, searchID) { return aj.resetSearchCoroutine(query, searchID); },
		continueSearchCoroutine: function() { return aj.continueSearchCoroutine(); }
	};
	
})();





/*

https://github.com/jcmellado/js-lzma

Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

References:
- "LZMA SDK" by Igor Pavlov
  http://www.7-zip.org/sdk.html
- "The .lzma File Format" from xz documentation
  https://github.com/joachimmetz/xz/blob/master/doc/lzma-file-format.txt

*/

var LZMA = LZMA || {};

(function(LZMA) {

"use strict";

LZMA.OutWindow = function(){
  this._windowSize = 0;
};

LZMA.OutWindow.prototype.create = function(windowSize){
  if ( (!this._buffer) || (this._windowSize !== windowSize) ){
    // using a typed array here gives a big boost on Firefox
    // not much change in chrome (but more memory efficient)
    this._buffer = new Uint8Array(windowSize);
  }
  this._windowSize = windowSize;
  this._pos = 0;
  this._streamPos = 0;
};

LZMA.OutWindow.prototype.flush = function(){
  var size = this._pos - this._streamPos;
  if (size !== 0){
    if (this._stream.writeBytes){
      this._stream.writeBytes(this._buffer, size);
    } else {
      for (var i = 0; i < size; i ++){
        this._stream.writeByte(this._buffer[i]);
      }
    }
    if (this._pos >= this._windowSize){
      this._pos = 0;
    }
    this._streamPos = this._pos;
  }
};

LZMA.OutWindow.prototype.releaseStream = function(){
  this.flush();
  this._stream = null;
};

LZMA.OutWindow.prototype.setStream = function(stream){
  this.releaseStream();
  this._stream = stream;
};

LZMA.OutWindow.prototype.init = function(solid){
  if (!solid){
    this._streamPos = 0;
    this._pos = 0;
  }
};

LZMA.OutWindow.prototype.copyBlock = function(distance, len){
  var pos = this._pos - distance - 1;
  if (pos < 0){
    pos += this._windowSize;
  }
  while(len --){
    if (pos >= this._windowSize){
      pos = 0;
    }
    this._buffer[this._pos ++] = this._buffer[pos ++];
    if (this._pos >= this._windowSize){
      this.flush();
    }
  }
};

LZMA.OutWindow.prototype.putByte = function(b){
  this._buffer[this._pos ++] = b;
  if (this._pos >= this._windowSize){
    this.flush();
  }
};

LZMA.OutWindow.prototype.getByte = function(distance){
  var pos = this._pos - distance - 1;
  if (pos < 0){
    pos += this._windowSize;
  }
  return this._buffer[pos];
};

LZMA.RangeDecoder = function(){
};

LZMA.RangeDecoder.prototype.setStream = function(stream){
  this._stream = stream;
};

LZMA.RangeDecoder.prototype.releaseStream = function(){
  this._stream = null;
};

LZMA.RangeDecoder.prototype.init = function(){
  var i = 5;

  this._code = 0;
  this._range = -1;

  while(i --){
    this._code = (this._code << 8) | this._stream.readByte();
  }
};

LZMA.RangeDecoder.prototype.decodeDirectBits = function(numTotalBits){
  var result = 0, i = numTotalBits, t;

  while(i --){
    this._range >>>= 1;
    t = (this._code - this._range) >>> 31;
    this._code -= this._range & (t - 1);
    result = (result << 1) | (1 - t);

    if ( (this._range & 0xff000000) === 0){
      this._code = (this._code << 8) | this._stream.readByte();
      this._range <<= 8;
    }
  }

  return result;
};

LZMA.RangeDecoder.prototype.decodeBit = function(probs, index){
  var prob = probs[index],
      newBound = (this._range >>> 11) * prob;

  if ( (this._code ^ 0x80000000) < (newBound ^ 0x80000000) ){
    this._range = newBound;
    probs[index] += (2048 - prob) >>> 5;
    if ( (this._range & 0xff000000) === 0){
      this._code = (this._code << 8) | this._stream.readByte();
      this._range <<= 8;
    }
    return 0;
  }

  this._range -= newBound;
  this._code -= newBound;
  probs[index] -= prob >>> 5;
  if ( (this._range & 0xff000000) === 0){
    this._code = (this._code << 8) | this._stream.readByte();
    this._range <<= 8;
  }
  return 1;
};

LZMA.initBitModels = function(probs, len){
  while(len --){
    probs[len] = 1024;
  }
};

LZMA.BitTreeDecoder = function(numBitLevels){
  this._models = [];
  this._numBitLevels = numBitLevels;
};

LZMA.BitTreeDecoder.prototype.init = function(){
  LZMA.initBitModels(this._models, 1 << this._numBitLevels);
};

LZMA.BitTreeDecoder.prototype.decode = function(rangeDecoder){
  var m = 1, i = this._numBitLevels;

  while(i --){
    m = (m << 1) | rangeDecoder.decodeBit(this._models, m);
  }
  return m - (1 << this._numBitLevels);
};

LZMA.BitTreeDecoder.prototype.reverseDecode = function(rangeDecoder){
  var m = 1, symbol = 0, i = 0, bit;

  for (; i < this._numBitLevels; ++ i){
    bit = rangeDecoder.decodeBit(this._models, m);
    m = (m << 1) | bit;
    symbol |= bit << i;
  }
  return symbol;
};

LZMA.reverseDecode2 = function(models, startIndex, rangeDecoder, numBitLevels){
  var m = 1, symbol = 0, i = 0, bit;

  for (; i < numBitLevels; ++ i){
    bit = rangeDecoder.decodeBit(models, startIndex + m);
    m = (m << 1) | bit;
    symbol |= bit << i;
  }
  return symbol;
};

LZMA.LenDecoder = function(){
  this._choice = [];
  this._lowCoder = [];
  this._midCoder = [];
  this._highCoder = new LZMA.BitTreeDecoder(8);
  this._numPosStates = 0;
};

LZMA.LenDecoder.prototype.create = function(numPosStates){
  for (; this._numPosStates < numPosStates; ++ this._numPosStates){
    this._lowCoder[this._numPosStates] = new LZMA.BitTreeDecoder(3);
    this._midCoder[this._numPosStates] = new LZMA.BitTreeDecoder(3);
  }
};

LZMA.LenDecoder.prototype.init = function(){
  var i = this._numPosStates;
  LZMA.initBitModels(this._choice, 2);
  while(i --){
    this._lowCoder[i].init();
    this._midCoder[i].init();
  }
  this._highCoder.init();
};

LZMA.LenDecoder.prototype.decode = function(rangeDecoder, posState){
  if (rangeDecoder.decodeBit(this._choice, 0) === 0){
    return this._lowCoder[posState].decode(rangeDecoder);
  }
  if (rangeDecoder.decodeBit(this._choice, 1) === 0){
    return 8 + this._midCoder[posState].decode(rangeDecoder);
  }
  return 16 + this._highCoder.decode(rangeDecoder);
};

LZMA.Decoder2 = function(){
  this._decoders = [];
};

LZMA.Decoder2.prototype.init = function(){
  LZMA.initBitModels(this._decoders, 0x300);
};

LZMA.Decoder2.prototype.decodeNormal = function(rangeDecoder){
  var symbol = 1;

  do{
    symbol = (symbol << 1) | rangeDecoder.decodeBit(this._decoders, symbol);
  }while(symbol < 0x100);

  return symbol & 0xff;
};

LZMA.Decoder2.prototype.decodeWithMatchByte = function(rangeDecoder, matchByte){
  var symbol = 1, matchBit, bit;

  do{
    matchBit = (matchByte >> 7) & 1;
    matchByte <<= 1;
    bit = rangeDecoder.decodeBit(this._decoders, ( (1 + matchBit) << 8) + symbol);
    symbol = (symbol << 1) | bit;
    if (matchBit !== bit){
      while(symbol < 0x100){
        symbol = (symbol << 1) | rangeDecoder.decodeBit(this._decoders, symbol);
      }
      break;
    }
  }while(symbol < 0x100);

  return symbol & 0xff;
};

LZMA.LiteralDecoder = function(){
};

LZMA.LiteralDecoder.prototype.create = function(numPosBits, numPrevBits){
  var i;

  if (this._coders
    && (this._numPrevBits === numPrevBits)
    && (this._numPosBits === numPosBits) ){
    return;
  }
  this._numPosBits = numPosBits;
  this._posMask = (1 << numPosBits) - 1;
  this._numPrevBits = numPrevBits;

  this._coders = [];

  i = 1 << (this._numPrevBits + this._numPosBits);
  while(i --){
    this._coders[i] = new LZMA.Decoder2();
  }
};

LZMA.LiteralDecoder.prototype.init = function(){
  var i = 1 << (this._numPrevBits + this._numPosBits);
  while(i --){
    this._coders[i].init();
  }
};

LZMA.LiteralDecoder.prototype.getDecoder = function(pos, prevByte){
  return this._coders[( (pos & this._posMask) << this._numPrevBits)
    + ( (prevByte & 0xff) >>> (8 - this._numPrevBits) )];
};

LZMA.Decoder = function(){
  this._outWindow = new LZMA.OutWindow();
  this._rangeDecoder = new LZMA.RangeDecoder();
  this._isMatchDecoders = [];
  this._isRepDecoders = [];
  this._isRepG0Decoders = [];
  this._isRepG1Decoders = [];
  this._isRepG2Decoders = [];
  this._isRep0LongDecoders = [];
  this._posSlotDecoder = [];
  this._posDecoders = [];
  this._posAlignDecoder = new LZMA.BitTreeDecoder(4);
  this._lenDecoder = new LZMA.LenDecoder();
  this._repLenDecoder = new LZMA.LenDecoder();
  this._literalDecoder = new LZMA.LiteralDecoder();
  this._dictionarySize = -1;
  this._dictionarySizeCheck = -1;

  this._posSlotDecoder[0] = new LZMA.BitTreeDecoder(6);
  this._posSlotDecoder[1] = new LZMA.BitTreeDecoder(6);
  this._posSlotDecoder[2] = new LZMA.BitTreeDecoder(6);
  this._posSlotDecoder[3] = new LZMA.BitTreeDecoder(6);
};

LZMA.Decoder.prototype.setDictionarySize = function(dictionarySize){
  if (dictionarySize < 0){
    return false;
  }
  if (this._dictionarySize !== dictionarySize){
    this._dictionarySize = dictionarySize;
    this._dictionarySizeCheck = Math.max(this._dictionarySize, 1);
    this._outWindow.create( Math.max(this._dictionarySizeCheck, 4096) );
  }
  return true;
};

LZMA.Decoder.prototype.setLcLpPb = function(lc, lp, pb){
  var numPosStates = 1 << pb;

  if (lc > 8 || lp > 4 || pb > 4){
    return false;
  }

  this._literalDecoder.create(lp, lc);

  this._lenDecoder.create(numPosStates);
  this._repLenDecoder.create(numPosStates);
  this._posStateMask = numPosStates - 1;

  return true;
};

LZMA.Decoder.prototype.setProperties = function(props){
  if ( !this.setLcLpPb(props.lc, props.lp, props.pb) ){
    throw Error("Incorrect stream properties");
  }
  if ( !this.setDictionarySize(props.dictionarySize) ){
    throw Error("Invalid dictionary size");
  }
};

LZMA.Decoder.prototype.decodeHeader = function(inStream){

  var properties, lc, lp, pb,
      uncompressedSize,
      dictionarySize;

  if (inStream.size < 13){
    return false;
  }

  // +------------+----+----+----+----+--+--+--+--+--+--+--+--+
  // | Properties |  Dictionary Size  |   Uncompressed Size   |
  // +------------+----+----+----+----+--+--+--+--+--+--+--+--+

  properties = inStream.readByte();
  lc = properties % 9;
  properties = ~~(properties / 9);
  lp = properties % 5;
  pb = ~~(properties / 5);

  dictionarySize = inStream.readByte();
  dictionarySize |= inStream.readByte() << 8;
  dictionarySize |= inStream.readByte() << 16;
  dictionarySize += inStream.readByte() * 16777216;

  uncompressedSize = inStream.readByte();
  uncompressedSize |= inStream.readByte() << 8;
  uncompressedSize |= inStream.readByte() << 16;
  uncompressedSize += inStream.readByte() * 16777216;

  inStream.readByte();
  inStream.readByte();
  inStream.readByte();
  inStream.readByte();

  return {
    // The number of high bits of the previous
    // byte to use as a context for literal encoding.
    lc: lc,
    // The number of low bits of the dictionary
    // position to include in literal_pos_state.
    lp: lp,
    // The number of low bits of the dictionary
    // position to include in pos_state.
    pb: pb,
    // Dictionary Size is stored as an unsigned 32-bit
    // little endian integer. Any 32-bit value is possible,
    // but for maximum portability, only sizes of 2^n and
    // 2^n + 2^(n-1) should be used.
    dictionarySize: dictionarySize,
    // Uncompressed Size is stored as unsigned 64-bit little
    // endian integer. A special value of 0xFFFF_FFFF_FFFF_FFFF
    // indicates that Uncompressed Size is unknown.
    uncompressedSize: uncompressedSize
  };
};

LZMA.Decoder.prototype.init = function(){
  var i = 4;

  this._outWindow.init(false);

  LZMA.initBitModels(this._isMatchDecoders, 192);
  LZMA.initBitModels(this._isRep0LongDecoders, 192);
  LZMA.initBitModels(this._isRepDecoders, 12);
  LZMA.initBitModels(this._isRepG0Decoders, 12);
  LZMA.initBitModels(this._isRepG1Decoders, 12);
  LZMA.initBitModels(this._isRepG2Decoders, 12);
  LZMA.initBitModels(this._posDecoders, 114);

  this._literalDecoder.init();

  while(i --){
    this._posSlotDecoder[i].init();
  }

  this._lenDecoder.init();
  this._repLenDecoder.init();
  this._posAlignDecoder.init();
  this._rangeDecoder.init();
};

LZMA.Decoder.prototype.decodeBody = function(inStream, outStream, maxSize){
  var state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, nowPos64 = 0, prevByte = 0,
      posState, decoder2, len, distance, posSlot, numDirectBits;

  this._rangeDecoder.setStream(inStream);
  this._outWindow.setStream(outStream);

  this.init();

  while(maxSize < 0 || nowPos64 < maxSize){
    posState = nowPos64 & this._posStateMask;

    if (this._rangeDecoder.decodeBit(this._isMatchDecoders, (state << 4) + posState) === 0){
      decoder2 = this._literalDecoder.getDecoder(nowPos64 ++, prevByte);

      if (state >= 7){
        prevByte = decoder2.decodeWithMatchByte(this._rangeDecoder, this._outWindow.getByte(rep0) );
      }else{
        prevByte = decoder2.decodeNormal(this._rangeDecoder);
      }
      this._outWindow.putByte(prevByte);

      state = state < 4? 0: state - (state < 10? 3: 6);

    }else{

      if (this._rangeDecoder.decodeBit(this._isRepDecoders, state) === 1){
        len = 0;
        if (this._rangeDecoder.decodeBit(this._isRepG0Decoders, state) === 0){
          if (this._rangeDecoder.decodeBit(this._isRep0LongDecoders, (state << 4) + posState) === 0){
            state = state < 7? 9: 11;
            len = 1;
          }
        }else{
          if (this._rangeDecoder.decodeBit(this._isRepG1Decoders, state) === 0){
            distance = rep1;
          }else{
            if (this._rangeDecoder.decodeBit(this._isRepG2Decoders, state) === 0){
              distance = rep2;
            }else{
              distance = rep3;
              rep3 = rep2;
            }
            rep2 = rep1;
          }
          rep1 = rep0;
          rep0 = distance;
        }
        if (len === 0){
          len = 2 + this._repLenDecoder.decode(this._rangeDecoder, posState);
          state = state < 7? 8: 11;
        }
      }else{
        rep3 = rep2;
        rep2 = rep1;
        rep1 = rep0;

        len = 2 + this._lenDecoder.decode(this._rangeDecoder, posState);
        state = state < 7? 7: 10;

        posSlot = this._posSlotDecoder[len <= 5? len - 2: 3].decode(this._rangeDecoder);
        if (posSlot >= 4){

          numDirectBits = (posSlot >> 1) - 1;
          rep0 = (2 | (posSlot & 1) ) << numDirectBits;

          if (posSlot < 14){
            rep0 += LZMA.reverseDecode2(this._posDecoders,
                rep0 - posSlot - 1, this._rangeDecoder, numDirectBits);
          }else{
            rep0 += this._rangeDecoder.decodeDirectBits(numDirectBits - 4) << 4;
            rep0 += this._posAlignDecoder.reverseDecode(this._rangeDecoder);
            if (rep0 < 0){
              if (rep0 === -1){
                break;
              }
              return false;
            }
          }
        }else{
          rep0 = posSlot;
        }
      }

      if (rep0 >= nowPos64 || rep0 >= this._dictionarySizeCheck){
        return false;
      }

      this._outWindow.copyBlock(rep0, len);
      nowPos64 += len;
      prevByte = this._outWindow.getByte(0);
    }
  }

  this._outWindow.flush();
  this._outWindow.releaseStream();
  this._rangeDecoder.releaseStream();

  return true;
};

LZMA.Decoder.prototype.setDecoderProperties = function(properties){
  var value, lc, lp, pb, dictionarySize;

  if (properties.size < 5){
    return false;
  }

  value = properties.readByte();
  lc = value % 9;
  value = ~~(value / 9);
  lp = value % 5;
  pb = ~~(value / 5);

  if ( !this.setLcLpPb(lc, lp, pb) ){
    return false;
  }

  dictionarySize = properties.readByte();
  dictionarySize |= properties.readByte() << 8;
  dictionarySize |= properties.readByte() << 16;
  dictionarySize += properties.readByte() * 16777216;

  return this.setDictionarySize(dictionarySize);
};

LZMA.decompress = function(properties, inStream, outStream, outSize){
  var decoder = new LZMA.Decoder();

  if ( !decoder.setDecoderProperties(properties) ){
    throw Error("Incorrect lzma stream properties");
  }

  if ( !decoder.decodeBody(inStream, outStream, outSize) ){
    throw Error("Error in lzma data stream");
  }

  return outStream;
};

LZMA.decompressFile = function(inStream, outStream){
  // upgrade ArrayBuffer to input stream
  if (inStream instanceof ArrayBuffer) {
    inStream = new LZMA.iStream(inStream);
  }
  // optionaly create a new output stream
  if (!outStream && LZMA.oStream) {
    outStream = new LZMA.oStream();
  }
  // create main decoder instance
  var decoder = new LZMA.Decoder();
  // read all the header properties
  var header = decoder.decodeHeader(inStream);
  // get maximum output size (very big!?)
  var maxSize = header.uncompressedSize;
  // setup/init decoder states
  decoder.setProperties(header);
  // invoke the main decoder function
  if ( !decoder.decodeBody(inStream, outStream, maxSize) ){
    // only generic error given here
    throw Error("Error in lzma data stream");
  }
  // return result
  return outStream;
};

LZMA.decode = LZMA.decompressFile;

})(LZMA);
