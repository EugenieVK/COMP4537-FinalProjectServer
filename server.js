const http = require('http');

http.createServer(async (req, res) => {
    const urlParams = req.url.split("/");
    if (urlParams[1] == "favicon.ico") {
        res.writeHead(204).end();
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    const response = await fetch(`http://165.227.45.49:8000/generate/?prompt="bread","milk","eggs"`)
    const data = await response.json();

    res.write(data);
       
    res.end();



}).listen(8081, ()=>{
    console.log(`Server is running!`);
});