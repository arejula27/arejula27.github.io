+++
title = 'Create your own Bitcoin network with Regtest in Ubuntu 20.04'
date = 2025-03-02T15:29:21+01:00
draft = true
tags = ['bitcoin', 'regtest', 'ubuntu', 'crypto']
description = "The first approach to bitcoin is always a bit overwhelming, while hands-on experience is the best way to learn, no one wants to risk losing money in the process. That’s where Bitcoin Regtest comes in—a private, customizable testing environment that lets you explore Bitcoin’s mechanics safely. Whether you’re developing, testing transactions, or experimenting with new ideas, Regtest allows you to mine blocks instantly, bypass fees, and make mistakes without real-world consequences.  In this guide, we’ll walk through setting up a Regtest environment from scratch in an Ubuntu 20.04 VM. You can use a different version, but some steps may vary. This will allow you to experiment with Bitcoin on your own terms. Let’s get started!"
+++
The first approach to bitcoin is always a bit overwhelming, while hands-on experience is the best way to learn, no one wants to risk losing money in the process. That’s where Bitcoin Regtest comes in—a private, customizable testing environment that lets you explore Bitcoin’s mechanics safely. Whether you’re developing, testing transactions, or experimenting with new ideas, Regtest allows you to mine blocks instantly, bypass fees, and make mistakes without real-world consequences.

Regtest (short for Regression Test mode) lets you create a private Bitcoin network on your own machine. Unlike Testnet or Mainnet, it gives you full control over block generation and confirmations, making it perfect for development, debugging, and learning how Bitcoin works under the hood.

In this guide, we’ll walk through setting up a Regtest environment from scratch in an Ubuntu 20.04 VM. You can use a different version, but some steps may vary. This will allow you to experiment with Bitcoin on your own terms. Let’s get started!

## Step 1:Create a new Ubuntu 20.04 VM 
Requirements:
- 50	GB of disk space
- 6 GB of RAM

## Step 2: Install Bitcoin Core

Alright, first things first—let’s get Bitcoin Core installed and running in Regtest mode.

Start by downloading [Bitcoin Core](https://bitcoin.org/en/download). Since we’re using Linux, we need to extract the .tar.gz file. Once extracted, we’ll copy all binaries from the bin folder to /usr/bin so they’re accessible system-wide:
```bash
tar -xzvf  <bitcoin-core-version>-x86_64-linux-gnu.tar.gz
sudo cp <bitcoin-core-version>/bin/* /usr/bin
```
This ensures you can run Bitcoin Core commands from anywhere in the terminal. Now, let’s move on to configuring Regtest mode!

Now, configure Bitcoin Core for Regtest. Edit your `~/.bitcoin/bitcoin.conf` file and add:
```
[regtest]
regtest=1
server=1
daemon=0
txindex=1
rpcuser=bitcoin
rpcpassword=bitcoin
rpcallowip=127.0.0.1
rpcport=18443
listen=1
port=18444
```
Now run the following command to start Bitcoin Core in Regtest mode and check if it has been installed correctly:

```bash
bitcoind -regtest
```
Open another terminal and verify if it's running:

```bash
bitcoin-cli -regtest getblockchaininfo
```

If everything is working, you should see detailed information about your Regtest blockchain. At this point, it should have **0 blocks** since no mining has occurred yet.


To stop Bitcoin Core, simply press `Ctrl + C` in the terminal where `bitcoind` is running.
Now we are going to create a systemd service to run Bitcoin Core as a service, so it starts automatically when the computer boots up. Create a file at `/etc/systemd/system/bitcoind.service` with the following content, replacing `<your-username>` with your actual username:
```
[Unit]
Description=Bitcoin regtest Daemon
After=network.target

[Service]
User=<your-username>
ExecStart=/usr/bin/bitcoind -regtest -conf=/home/<your-username>/.bitcoin/bitcoin.conf
ExecStop=/usr/bin/bitcoin-cli -regtest stop
Restart=always
LimitNOFILE=1024

[Install]
WantedBy=multi-user.target
```
Reload and start the service with the following commands:
```bash
sudo systemctl daemon-reload
sudo systemctl start bitcoind.service
```

Now Bitcoin Core runs automatically! Check that it is running with the following command:
```bash
bitcoin-cli -regtest getblockchaininfo
```
If you see the blockchain information, you're all set!

## Step 2: Install Sparrow Wallet

Sparrow Wallet is a great GUI to manage your Bitcoin transactions, even in Regtest mode.

Download the .deb file and install it.

Modify the desktop launcher file at /usr/share/applications/sparrow-Sparrow.desktop:

Exec=/opt/sparrow/bin/Sparrow --network regtest %U

Launch Sparrow and connect it to your Regtest server using the username and password you set earlier.

Create a wallet and use this test seed (no, this is not financial advice! 😆):

1 tattoo
2 weather
3 skill
4 minute
5 review
6 favorite
7 bulk
8 seed
9 stone
10 swarm
11 scorpion
12 fossil

