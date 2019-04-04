module.exports = (hostname, clientId) => `
<!DOCTYPE html>
<html>

<head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Node oAuth2 Example</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <!-- <link rel="stylesheet" type="text/css" media="screen" href="main.css" /> -->
        <!-- <script src="main.js"></script> -->
</head>

<body>
        <a href="/oauth/authenticate-github">Login with github</a>
</body>

</html>
`
