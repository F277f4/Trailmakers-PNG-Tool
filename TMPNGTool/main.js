const PNG = require("pngjs").PNG;
const fs = require("fs")

// por la nova skripto
var protobuf = require("protobufjs");
const { Smaz } = require('@remusao/smaz');
var lz4 = require("lz4js")

// for encoding
const { xxHash32 } = require('js-xxhash');

// for encoding
let hashSeed = 0;

let dataFile = document.getElementById("dataFile");
let imageFile = document.getElementById("imageFile");
let byteStream = document.getElementById("byteStream");
let jsonFile = document.getElementById("jsonFile");

let imageOutput = document.getElementById("imageOutput");
let textOutput = document.getElementById("textOutput");
let binaryOutput = document.getElementById("binaryOutput");
let jsonOutput = document.getElementById("jsonOutput");

let descriptionChecked = document.getElementById("description");
let lowerBitChecked = document.getElementById("lowerBit");
let solidChecked = document.getElementById("solid");

let imageSizeValue = document.getElementById("imageSize");
let imageSquishValue = document.getElementById("imageSquish");
let imageGirthValue = document.getElementById("imageGirth");

let advancedCheck = document.getElementById("advancedCheck");
let exportByteArrayCheck = document.getElementById("exportByteArrayCheck");
let exportJsonCheck = document.getElementById("exportJsonCheck");

let jsonFileName = "structure"

dataFile.onchange = function(event){
	const reader = new FileReader()
	reader.onload = handleFileLoad
	reader.readAsArrayBuffer(dataFile.files[0]);
}

function handleFileLoad(event) {
	console.log(event.target.result)
	new PNG().parse(event.target.result, function (error, data) {
		console.log(error, data);
		extractTrans(data.data, data.height, data.width);
		if (exportByteArrayCheck.checked) {
			exportByteArray((new Uint8Array(pngTransData)));
		} else if (exportJsonCheck.checked) {
			// use with a lot, a lot of care
			binaryToJson(pngTransData);
		}
	});
}

pngTransData = []

function extractTrans(data, height, width) {
	pngTransData = []
	// flip the data because it's upside down by default
	let flipped = new Uint8Array(data.length)
	for (let i = 0; i < height; i++) {
		flipped.set(data.slice(i*width*4, (i+1)*width*4), (height-i-1)*width*4);
	}
	console.log(flipped);
	
	// not the best but this basically extracts the colour values if the alpha is 0, I don't know if this is the actual spec, but it works so eh
	let zeroLimit = 0;
	let j = 0;
	for (let i = 0; i < flipped.length/4; i++) {
		
		if (flipped[i*4+3] == 0 && zeroLimit < width) {
			pngTransData[j*3] = flipped[i*4]
			pngTransData[j*3+1] = flipped[i*4+1]
			pngTransData[j*3+2] = flipped[i*4+2]
			if (pngTransData[i*3] + pngTransData[i*3+1] + pngTransData[i*3+2] == 0) {
				zeroLimit++
			}
			j++
		}
	}
}

imageFile.onchange = function(event){
	const reader = new FileReader()
	reader.onload = handleImageLoad
	reader.readAsArrayBuffer(imageFile.files[0]);
}

function handleImageLoad(event) {
	console.log(event.target.result)
	// load visual png using the module
	new PNG().parse(event.target.result, function (error, imageData) {
		console.log(descriptionChecked.checked, "sdfsjpidfjsd");
		imageLoadExecute(imageData);
	});
}
function imageLoadExecute (data) {
	if (!descriptionChecked.checked) {
		// it's constant for now
		let dst = new PNG({ width: 512, height: 512});
		
		// basically puts the loaded visual png into an empty 512x512 png. Also we don't do error catching here so god knows what happens if you use an image larger than that
		data.bitblt(dst,0,0,data.width,data.height,256-parseInt(data.width/2),256-parseInt(data.height/2))
		
		dst.data = insertTrans(dst);
		console.log(dst);
		exportImage(PNG.sync.write(dst));
	} else {
		// this is the png to rich text. It's basically just taking an image and creating an array of uncode characters and setting their colour to the ones corresponding to the input image. Nothing fancy
		let textArray = []
		
		console.log(data.data[0]);
		
		for (let i = 0; i < data.data.length; i++) {
			textArray[i] = data.data[i].toString(16);
			if (textArray[i].length == 1) {
				textArray[i] = "0" + textArray[i]
			}
			if (lowerBitChecked.checked) {
				textArray[i] = textArray[i].charAt(0)
			}
		}
		
		let outputTextVar = ""
		
		outputTextVar = "<size=" + (imageSizeValue.value/data.width*imageGirthValue.value*0.045).toString() + "px><mspace=" + (imageSizeValue.value/data.width*3).toString() + "px><line-height=" + (imageSizeValue.value/data.width*imageGirthValue.value*0.025).toString() + "px>"
		
		for (let i = 0; i < textArray.length/4; i++) {
			if (textArray[(i-1)*4] == textArray[i*4] && textArray[(i-1)*4+1] == textArray[i*4+1] && textArray[(i-1)*4+2] == textArray[i*4+2] && textArray[(i-1)*4+3] == textArray[i*4+3]) {
				outputTextVar = outputTextVar + "\u2589"
				if ((i+1)%data.width == 0) {
					outputTextVar = outputTextVar + "<br>"
				}
				
				continue;
			}
			outputTextVar = outputTextVar + "<#"
			outputTextVar = outputTextVar + textArray[i*4]
			outputTextVar = outputTextVar + textArray[i*4+1]
			outputTextVar = outputTextVar + textArray[i*4+2]
			if (!solidChecked.checked) {
				outputTextVar = outputTextVar + textArray[i*4+3]
			}
			outputTextVar = outputTextVar + ">"
			outputTextVar = outputTextVar + "\u2589"
			if ((i+1)%data.width == 0) {
				outputTextVar = outputTextVar + "<br>"
			}
		}
		outputTextVar = outputTextVar.replace(/<#ffffffff>/g, "<#fff>");
		outputTextVar = outputTextVar.replace(/<#000000ff>/g, "<#000f>");
		outputTextVar = outputTextVar + "</size></mspace></line-height><#eee><br>"
		
		console.log(textArray, outputTextVar);
		exportDescriptionImage(outputTextVar);
	}
}

function insertTrans(data) {
	let trans = new Uint8Array(data.length)
	console.log(data.data, data.width, data.height);
	
	// bad hack because the header is curretnly always 248 in size, if it ever changes I will need to change this. This is the alpha (and probably the RGB if it exceeds a byte) if the pixel
	data.data[2047] = 248
	
	// store direction is mirrored
	trans = flipVert(data.data, data.width, data.height);
	
	// basically the reverse of the extractor. For every transparent pixel in the target visual png, set the RGB values to the ones in the original
	let j = 0;
	for (let i = 0; i < pngTransData.length/3; i++) {
		if (trans[i*4+3] == 0) {
			trans[i*4] = pngTransData[j*3]
			trans[i*4+1] = pngTransData[j*3+1]
			trans[i*4+2] = pngTransData[j*3+2]
			j++
		}
	}
	
	// store direction is mirrored
	trans = flipVert(trans, data.width, data.height);
	
	return trans
}

function flipVert(data, width, height) {
	let flipped = new Uint8Array(data.length)
	for (let i = 0; i < height; i++) {
		flipped.set(data.slice(i*width*4, (i+1)*width*4), (height-i-1)*width*4);
	}
	return flipped
}

byteStream.onchange = function(event){
	const reader = new FileReader()
	reader.onload = handlebyteStream
	reader.readAsArrayBuffer(byteStream.files[0]);
}

function handlebyteStream(event) {
	console.log(event.target.result);
	// if we load a byte stream we can completely ignore loading a data image and set the data to what's contained in the stream
	pngTransData = new Uint8Array(event.target.result)
}

// all these just do the html thingy and get you a nice file
function exportImage(byteArray) {
	let blob = new Blob([byteArray], {type: 'application/octet-stream'});
	
	blobUrl = URL.createObjectURL(blob);
	
	imageOutput.href = blobUrl
	imageOutput.download = "blueprint.png"
}

function exportByteArray(byteArray) {
	let blob = new Blob([byteArray], {type: 'application/octet-stream'});
	
	blobUrl = URL.createObjectURL(blob);
	
	binaryOutput.href = blobUrl
	binaryOutput.download = "blueprint.tmsf"
}

function exportDescriptionImage(byteArray) {
	let blob = new Blob([byteArray], {type: 'application/octet-stream'});
	
	blobUrl = URL.createObjectURL(blob);
	
	textOutput.href = blobUrl
	textOutput.download = "image.txt"
}

function exportJson(byteArray) {
	let blob = new Blob([byteArray], {type: 'application/octet-stream'});
	
	blobUrl = URL.createObjectURL(blob);
	
	jsonOutput.href = blobUrl
	jsonOutput.download = jsonFileName + ".json"
}

// for the html
advancedCheck.onchange = function(event){
	console.log(event)
	console.log(event.target.checked)
	let elements = document.querySelectorAll('.advanced');
	if (event.target.checked) {
		for(var i=0; i<elements.length; i++){
			elements[i].style.display = "";
		}
	} else {
		for(var i=0; i<elements.length; i++){
			elements[i].style.display = "none";
		}
		exportByteArrayCheck.checked = false;
		exportJsonCheck.checked = false;
	}
}


let utf8decoder = new TextDecoder();

let JSONOutputString = "";

let structureNameGlobal

// smaz table, I had to steal the one in the traileditor repo :bebezwe:
const smaz = new Smaz([
	" ", "the", "e", "t", "a", "of", "o", "and", "i", "n", "s", "e ", "r", " th",
    " t", "in", "he", "th", "h", "he ", "to", "\r\n", "l", "s ", "d", " a", "an",
    "er", "c", " o", "d ", "on", " of", "re", "of ", "t ", ", ", "is", "u", "at",
    "   ", "n ", "or", "which", "f", "m", "as", "it", "that", "\n", "was", "en",
    "  ", " w", "es", " an", " i", "\r", "f ", "g", "p", "nd", " s", "nd ", "ed ",
    "w", "ed", "http://", "for", "te", "ing", "y ", "The", " c", "ti", "r ", "his",
    "st", " in", "ar", "nt", ",", " to", "y", "ng", " h", "with", "le", "al", "to ",
    "b", "ou", "be", "were", " b", "se", "o ", "ent", "ha", "ng ", "their", "\"",
    "hi", "from", " f", "in ", "de", "ion", "me", "v", ".", "ve", "all", "re ",
    "ri", "ro", "is ", "co", "f t", "are", "ea", ". ", "her", " m", "er ", " p",
    "es ", "by", "they", "di", "ra", "ic", "not", "s, ", "d t", "at ", "ce", "la",
    "h ", "ne", "as ", "tio", "on ", "n t", "io", "we", " a ", "om", ", a", "s o",
    "ur", "li", "ll", "ch", "had", "this", "e t", "g ", "e\r\n", " wh", "ere",
    " co", "e o", "a ", "us", " d", "ss", "\n\r\n", "\r\n\r", "=\"", " be", " e",
    "s a", "ma", "one", "t t", "or ", "but", "el", "so", "l ", "e s", "s,", "no",
    "ter", " wa", "iv", "ho", "e a", " r", "hat", "s t", "ns", "ch ", "wh", "tr",
    "ut", "/", "have", "ly ", "ta", " ha", " on", "tha", "-", " l", "ati", "en ",
    "pe", " re", "there", "ass", "si", " fo", "wa", "ec", "our", "who", "its", "z",
    "fo", "rs", ">", "ot", "un", "<", "im", "th ", "nc", "ate", "><", "ver", "ad",
    " we", "ly", "ee", " n", "id", " cl", "ac", "il", "</", "rt", " wi", "div",
    "e, ", " it", "whi", " ma", "ge", "x", "e c", "men", ".com"
]);
// honestly I don't know why this is still here
console.log(Buffer.from(smaz.compress("Hello this is a test of smaz 5901238591sdklj")).toString('hex'));

function binaryToJson(binary) {
	JSONOutputString = "";
	
	console.log(new Uint8Array(binary).buffer);
	
	const loadedFile = new DataView(new Uint8Array(binary).buffer)
	const loadedUint8 = new Uint8Array(binary)
	
	console.log(loadedFile)
	console.log(loadedUint8)
	// debug keep
	
	// Length fix again. As long as the devs don't change the header this will just work for now
	let offset = 219
	
	console.log(loadedFile.getUint32(offset, false))
	// debug keep
	
	// this is actually not necessary but some creator data (ususally just spaces) are stored here
	creatorLength = loadedFile.getUint32(offset, false)
	offset += 4
	
	// make the data string and move on to the next thing
	let creatorString = utf8decoder.decode(loadedUint8.subarray(offset, offset+creatorLength));
	offset += creatorLength
	
	console.log(loadedFile.getUint32(offset, true))
	// debug keep
	
	// after the creator string "thing", there are three 32 bit values that indicate the length of: structure, identifier (always the same since it's a GUID), and description
	let structureByteSize = loadedFile.getUint32(offset, true)
	offset += 4
	
	console.log(loadedFile.getUint32(offset, true))
	// debug keep
	let structureIdentifierSize = loadedFile.getUint32(offset, true)
	offset += 4
	
	console.log(loadedFile.getUint32(offset, true));
	// debug keep
	let structureMetaByteSize = loadedFile.getUint32(offset, true);
	// there is a two byte value we can skip. Check the orignal extractor for details
	offset += 6
	
	console.log(lz4.decompress(loadedUint8.subarray(offset, offset+structureByteSize)));
	// !important AAAAAAAAAAAAAAAAA
	
	// structure is compressed with lz4
	let StructureGraphSaveDataProtoArray = lz4.decompress(loadedUint8.subarray(offset, offset+structureByteSize));
	offset += structureByteSize
	
	console.log(utf8decoder.decode(loadedUint8.subarray(offset+4, offset+structureIdentifierSize)));
	// debug keep
	
	// The GUID can just be converted into text directly, skipping over the identifier
	let StructureSaveIdentifierProto = utf8decoder.decode(loadedUint8.subarray(offset+4, offset+structureIdentifierSize));
	offset += structureIdentifierSize
	
	console.log(loadedUint8.subarray(offset, offset+structureMetaByteSize));
	console.log(smaz.decompress(loadedUint8.subarray(offset, offset+structureMetaByteSize)));
	console.log(Buffer.from(smaz.decompress(loadedUint8.subarray(offset, offset+structureMetaByteSize))).toString('hex'));
	// !important AAAA
	
	// description is in smaz, using the table defined
	let StructureMetaDataProtoArray = new Uint8Array(Buffer.from(smaz.decompress(loadedUint8.subarray(offset, offset+structureMetaByteSize)), "binary"));
	
	console.log("graph", StructureGraphSaveDataProtoArray);
	console.log("meta", StructureMetaDataProtoArray);
	decodeStructureGraphSaveDataAndUse(StructureGraphSaveDataProtoArray, StructureMetaDataProtoArray);
}

// these four functions basically just takes the raw protobuf data and converts it into something more human readable. It has its issues. Most notably the protofile is incomplete.
function StructureGraphSaveDataDecode(buffer) {
	return new Promise((resolve, reject) => {
		// trailmakers.txt is actually the .proto file but don't tell neocities that
		protobuf.load("trailmakers.txt", function(err, root) {
			if (err) return reject(err);
			
			var StructureGraphSaveDataProto = root.lookupType("StructureGraphSaveDataProto");
			
			try {
				let message = StructureGraphSaveDataProto.decode(buffer);
				const object = StructureGraphSaveDataProto.toObject(message, {
					defaults: true, // Include default values
					longs: String,  // Optionally handle longs as strings
					enums: String,  // Optionally handle enums as strings
				});
				resolve(object);
			} catch (e) {
				if (e instanceof protobuf.util.ProtocolError) {
					// e.instance holds the so far decoded message with missing required fields
				} else {
					// wire format is invalid
					reject(e);
				}
			}
		});
	});
};

function StructureMetaDataDecode(buffer) {
	return new Promise((resolve, reject) => {
		protobuf.load("trailmakers.txt", function(err, root) {
			if (err) return reject(err);
			
			var StructureMetaDataProto = root.lookupType("StructureMetaDataProto");
			
			try {
				let message = StructureMetaDataProto.decode(buffer);
				resolve(message);
			} catch (e) {
				if (e instanceof protobuf.util.ProtocolError) {
					// e.instance holds the so far decoded message with missing required fields
					reject(e);
				} else {
					// wire format is invalid
					reject(e);
				}
			}
		});
	});
};

async function decodeStructureGraphSaveDataAndUse(buffer, x) {
	try {
		const message = await StructureGraphSaveDataDecode(buffer);
		JSONOutputString = ""
		JSONOutputString = JSON.stringify(message, null, 2)
		
		decodeStructureMetaDataAndUse(x);
	} catch (err) {
		console.error("Error decoding message:", err);
	}
}

async function decodeStructureMetaDataAndUse(buffer, x) {
	try {
		const message = await StructureMetaDataDecode(buffer);
		JSONOutputString = "{\n\"StructureGraphSaveDataProto\": " + JSONOutputString + ",\n\"StructureMetaDataProto\": " + JSON.stringify(message, null, 2) + "\n}"
		exportJson(JSONOutputString);
	} catch (err) {
		console.error("Error decoding message:", err);
	}
}

jsonFile.onchange = function(event){
	const reader = new FileReader()
	reader.onload = parseJson
	reader.readAsBinaryString(jsonFile.files[0]);
}

// don't even bother, It doesn't work. Not sure why but I am pretty sure it's because protobufjs wants 0 values instead of removing the value entirely. Could be wrong.
function parseJson(event) {
	protobuf.load("trailmakers.txt", function(err, root) {
		if (err)
			throw err;
		
		var StructureGraphSaveDataProto = root.lookupType("StructureGraphSaveDataProto");
		var StructureMetaDataProto = root.lookupType("StructureMetaDataProto");
		
		let fullProto = JSON.parse(event.target.result);
		
		console.log(fullProto.StructureGraphSaveDataProto);
		console.log(StructureGraphSaveDataProto.verify(fullProto.StructureGraphSaveDataProto));
		console.log(fullProto.StructureMetaDataProto);
		console.log(StructureMetaDataProto.verify(fullProto.StructureMetaDataProto));
		
		let StructureGraphSaveDataProtoArray = StructureGraphSaveDataProto.encode(fullProto.StructureGraphSaveDataProto).finish();
		let StructureMetaDataProtoArray = StructureMetaDataProto.encode(fullProto.StructureMetaDataProto).finish();
		console.log(StructureGraphSaveDataProtoArray, StructureMetaDataProtoArray);
		
		let structureChunk = lz4.compress(StructureGraphSaveDataProtoArray);
		let metaChunkString = smaz.compress(new TextDecoder().decode(StructureMetaDataProtoArray));
		console.log(structureChunk, metaChunkString, structureChunk.length, metaChunkString.length);
		console.log(Buffer.from(structureChunk).toString('hex'));
		
		dvgraph = new DataView(new ArrayBuffer(4), 0);
		dvgraph.setUint32(0, structureChunk.length + 4, 1);
		StructureGraphLengthUint8 = new Uint8Array(dvgraph.buffer);
		console.log('StructureGraphLengthUint8', StructureGraphLengthUint8);
		
		dvmeta = new DataView(new ArrayBuffer(4), 0);
		dvmeta.setUint32(0, metaChunkString.length, 1);
		StructureMetaLengthUint8 = new Uint8Array(dvmeta.buffer);
		console.log('StructureMetaLengthUint8', StructureMetaLengthUint8);
		
		dvhash = new DataView(new ArrayBuffer(4), 0);
		dvhash.setUint32(0, xxHash32(structureChunk, hashSeed), 1);
		hashUint8 = new Uint8Array(dvhash.buffer);
		console.log('hashUint8', hashUint8);
		
		// new chunk with hash
		structureChunkHashed = new Uint8Array(structureChunk.length + 4)
		
		structureChunkHashed.set(structureChunk)
		structureChunkHashed.set(hashUint8, structureChunk.length)
		structureChunkHashed.set([68, 64, 94], 4)
		
		finalUint8Array = new Uint8Array(structureChunkHashed.length + metaChunkString.length + 289)
		
		finalUint8Array.set(fileHeader)
		finalUint8Array.set(StructureGraphLengthUint8, 235)
		finalUint8Array.set(StructureMetaLengthUint8, 243)
		
		finalUint8Array.set(structureChunkHashed, 249)
		
		finalUint8Array.set([8, 2, 18, 36], 249 + structureChunkHashed.length)
		finalUint8Array.set(new TextEncoder().encode(guid()), 253 + structureChunkHashed.length)
		
		finalUint8Array.set(metaChunkString, 289 + structureChunkHashed.length)
		
		console.log(finalUint8Array, finalUint8Array[235], finalUint8Array[239], finalUint8Array[243]);
		
		pngTransData = finalUint8Array;
	});}

// long, never used
function guid() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

// too lazy to do something with the file header, so a copy paste is all I did
let fileHeader = [
    0,
    1,
    0,
    0,
    0,
    255,
    255,
    255,
    255,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    12,
    2,
    0,
    0,
    0,
    70,
    65,
    115,
    115,
    101,
    109,
    98,
    108,
    121,
    45,
    67,
    83,
    104,
    97,
    114,
    112,
    44,
    32,
    86,
    101,
    114,
    115,
    105,
    111,
    110,
    61,
    48,
    46,
    48,
    46,
    48,
    46,
    48,
    44,
    32,
    67,
    117,
    108,
    116,
    117,
    114,
    101,
    61,
    110,
    101,
    117,
    116,
    114,
    97,
    108,
    44,
    32,
    80,
    117,
    98,
    108,
    105,
    99,
    75,
    101,
    121,
    84,
    111,
    107,
    101,
    110,
    61,
    110,
    117,
    108,
    108,
    5,
    1,
    0,
    0,
    0,
    17,
    83,
    97,
    118,
    101,
    71,
    97,
    109,
    101,
    73,
    110,
    80,
    78,
    71,
    73,
    110,
    102,
    111,
    5,
    0,
    0,
    0,
    7,
    118,
    101,
    114,
    115,
    105,
    111,
    110,
    7,
    99,
    114,
    101,
    97,
    116,
    111,
    114,
    17,
    115,
    116,
    114,
    117,
    99,
    116,
    117,
    114,
    101,
    66,
    121,
    116,
    101,
    83,
    105,
    122,
    101,
    23,
    115,
    116,
    114,
    117,
    99,
    116,
    117,
    114,
    101,
    73,
    100,
    101,
    110,
    116,
    105,
    102,
    105,
    101,
    114,
    83,
    105,
    122,
    101,
    21,
    115,
    116,
    114,
    117,
    99,
    116,
    117,
    114,
    101,
    77,
    101,
    116,
    97,
    66,
    121,
    116,
    101,
    83,
    105,
    122,
    101,
    0,
    1,
    0,
    0,
    0,
    15,
    8,
    8,
    8,
    2,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    6,
    3,
    0,
    0,
    0,
    12,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    32,
    0,
    0,
    0,
    0,
    40,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    11,
    0
]