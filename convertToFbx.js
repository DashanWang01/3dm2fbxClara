
// There will be a node.js program.

// It will be given a directory to scan on the command line.

// We will have to somehow configure our tool so that it is using
// a specific username and token.  This will be the client's username/token.

// (Talk to Zhongrui about how he created his tool for Steelcase called
// ClaraMaxJS which exported from 3DS Max to Clara.io.)

// Then it scans that directory for *.3dm files (rhino files)

// Then one at a time it loads the rhino file and runs our custom Python script:

// // Rhino.exe /runscript="LoadMyPythonSCript();  SaveAsFBX( filename.fbx ); Exit()" theFileToLoad.3dm

// It exports the contents of the file to FBX to a temporary location on disk using a
// unique file name.

// Then it creates a new Clara.io scene with the same name as the current Rhino file
// and uploads the FBX into that scene via our Clara.io rest API.

// One Clara scene per original Rhino file.

// Thus there will be for example:

// B0009 will contain the results of the imported
// B0009.fbx, which was exported from the B0009.3dm



// Inside the node js program there should be a function called:

// //Use commander for parsing the command line arguments. https://www.npmjs.com/package/commander

// The program should probably have the option to both run on a directory or on a specific file:

// -d / --directory [directory path] // this will scan that directory
// -f / --file [file path] // this will just upload that individual file


// uploadDirectory( directoryPath );
//   uploadFile( filePath );
//     exportFromRhino( fileNameOfRhinoScene, callback( err, fileNameOfFBXScene ) {        
//         if( err ) // console.error(), console.exit();
//         createAndUploadClaraScene( fileNameOfFBXScene ) - creates new scene in Clara and uploads the FBX
//     });

var colors = require('colors');
var program = require('commander');
var exec = require('child_process').exec;
const util = require('util');
const fs = require('fs');


//-----------program starts here--------------//
program
    .version('0.1.0')
    .option('-d, --directory', 'upload from a directory')
    .option('-f, --file', 'upload a single file')
    .option('-t, --token', 'clara personal token')
    .option('-u, --username', 'clara username')
    .parse(process.argv)

// console.log(program)
if (!program.token) {
    console.error(colors.red('ERROR: ') + 'Token is required.  Please follow the format: -dut/-fut diractoryPath/youFileFullPath  yourUserName yourToken.')
} else if (!program.username) {
    console.error(colors.red('ERROR: ') + 'Username is required. Please follow the format: -dut/-fut diractoryPath/youFileFullPath yourUserName yourToken.')
} else {
    var clara = require('clara')({ apiToken: program.args[2], username: program.args[1] });
    main(program);
}

//------------program ends here--------------------//

//--------below are functions -------------------//

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

async function importFile(file, sceneId) {
    var importSetup = {
        sceneId: sceneId
    };
    console.log('file is')
    console.log(file)
    fs.exists(file, function (err) {
        if (err) console.log(err);
        else console.log(">>>>>>>>>>>>>>>");
    });
    const importOptimized = util.promisify(clara.scenes.importOptimized);

    try {
        let res = await importOptimized(importSetup, { files: [file] });
        console.log(colors.green('RESULT: ') + 'upladed successfully')
        return res
    } catch (err) {
        console.error(
            colors.red(
                'ERROR: Import file failed. Reason: ' +
                err.status +
                ' ' + err.response.text
            )
        );
        if (err.status === 401) {
            console.error('Have you set up your authentication properly?');
        }
        result.Error = {
            StatusCode: err.status,
            Message: err.response.text,
        };
    }
    //---------------------log--------------------//
    console.log(file)
    console.log(colors.green('INFO: ') + " upload successfully!")
}

async function convertFromDirectory(directoryPath) {
    let files = fs.readdirSync(directoryPath);

    for (let i = 0; i < files.length; i++) {
        if (endsWith(files[i], '3dm')) {
            try {
                await processFileDir(directoryPath, files[i], i);
            } catch (err) {
                console.error(colors.red('ERROR: ') + err);
                process.exit(1)
            }

        }
    }
}

async function processFileDir(directoryPath, file, i) {
    if(process.platform==='win32'){
       var cmdStr = '"C:/Program Files/Rhinoceros 5 (64-bit)/System/Rhino.exe" /runscript="_-RunPythonScript rihnoConvertFbx.py -exit" ' + '\"' + directoryPath + file + '\"'
    }else if(process.platform==='darwin'){
            //todo
    }
    // console.log(cmdStr)
    const execF = util.promisify(exec);
    console.log(i, ' process start')
    try {
        await execF(cmdStr);
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }
    try {
        var createdSceneResult = await createAndUploadClaraScene(file);
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }

    return createdSceneResult
}


async function convertOneFile(filePath) {
    // console.log(filePath)
    if (endsWith(filePath, '3dm')) {
        try {
            await processFileOneFile(filePath)
        } catch (err) {
            console.error(colors.red('ERROR: ') + err);
            process.exit(1)
        }

    } else {
        console.error(colors.red('ERROR: ') + "you path doesn't contain a file end with .3dm")
        process.exit(1);
    }
}

async function processFileOneFile(Path) {
    var cmdStr = '"C:/Program Files/Rhinoceros 5 (64-bit)/System/Rhino.exe" /runscript="_-RunPythonScript rihnoConvertFbx.py -exit" ' + '\"' + Path + '\"'
    console.log(cmdStr)
    const execFOne = util.promisify(exec);
    console.log(' process start')

    try {
        await execFOne(cmdStr);
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }
    try {
        var createdSceneResult = await createAndUploadClaraScene(Path)
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }

    return createdSceneResult;
}


async function createAndUploadClaraScene(filePath) {
    var newName = filePath.split('/').pop().slice(0, -4);
    var newPath = 'C:/temp/' + newName + '.fbx';

    console.log("new path is:")
    console.log(newPath)
    var newSceneId;

    //----------------creat a new scense with a name-----------------//

    var config = {
        'name': newName
    }

    const create = util.promisify(clara.scenes.create);
    // console.log(newName)

    try {
        var newScene = await create({}, config);
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }


    try {
        var importedFileResult = await importFile('C:/temp/' + newName + '.fbx', newScene._id)
    } catch (err) {
        console.error(colors.red('ERROR: ') + err);
        process.exit(1)
    }
    console.log('newScene is : ', newScene._id)
    return importedFileResult
}


function main(program) {
    if ((!program.directory && !program.file) || !program.args) {
        console.log('Wrong number of parameters. Please follow the format: -d/-f diractory path/you file full path')
        return;
    }
    // console.log(program.args)

    if (program.directory) {
        if (!endsWith(program.args[0], '/')) {
            console.log('Path has to be end with /')
            process.exit(1);
        }
        convertFromDirectory(program.args[0])
    } else if (program.file) {
        if (!endsWith(program.args[0], '.3dm')) {
            console.log('Path has to be end with .3dm')
            process.exit(1);
        }
        // console.log("program will convert a file")
        convertOneFile(program.args[0])
    } else {
        console.log('Wrong parameters')
    }
}



