# Public Node Repository

This project is hosted at http://nodes.scalaproject.io:11812/. The propose of this project is to host nodes that are active for applications or system.


## How to get listed @ contribute?

You can create a pull request by adding your nodes to the this file [nodes.json](https://github.com/scala-network/nodes/blob/main/nodes.json) and add your name to this readme in credits section


## How does the service works?

The service currently is hosted at http://nodes.scalaproject.io:11812/. You can get the list of nodes by just going to the link it will return the list in json format. 

## Using node service for an rpc request

The other flavour we add in into this project is the ability to randomly pick a node to be use. This can be done by pointing your rpc requests to `nodes.scalaproject.io:11812`.

## How can I install this for my personal use?
Below is the installation process for this service to be hosted

1. Install nvm by using the following cURL command to install into your system:
```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
```

2. Install node v16 
```sh
nvm install 16
nvm alias default 16
nvm use default
```

3. Go to the directory where the source code will be downloaded and run the service
```sh
cd <working directory>
git clone https://github.com/scala-network/nodes.git
cd nodes
npm install
node index.js
```

You can use termux or screen to run you code in the background


## Credits
* [cryptoamity](https://github.com/ahmyi)
* [hayzam](https://github.com/hayzamjs)


Sorry if I missed your names in the credits. Create a pull request we will add you in.
