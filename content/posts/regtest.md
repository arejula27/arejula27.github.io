+++
title = 'Regtest'
date = 2025-03-02T15:29:21+01:00
draft = true
+++

If you’re building, testing, or experimenting with Bitcoin, you need a safe and flexible environment—one where you can instantly mine blocks, test transactions without fees, and break things without consequences. That’s exactly what Bitcoin Regtest is for.

Regtest (short for Regression Test mode) lets you create a private Bitcoin network on your own machine. Unlike Testnet or Mainnet, it gives you full control over block generation and confirmations, making it perfect for development, debugging, and learning how Bitcoin works under the hood.

In this guide, we’ll walk through setting up a Regtest environment from scratch in an Ubuntu 20.04 VM. You can use a different version, but some steps may vary. This will allow you to experiment with Bitcoin on your own terms. Let’s get started!

## Step 1: Install Bitcoin Core

Alright, first things first—let’s get Bitcoin Core installed and running in Regtest mode.

Start by downloading [Bitcoin Core](https://bitcoin.org/en/download). Since we’re using Linux, we need to extract the .tar.gz file. Once extracted, we’ll copy all binaries from the bin folder to /usr/bin so they’re accessible system-wide:
```bash
sudo cp path/to/extracted/bitcoin/bin/* /usr/bin
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


 ==TODO==
Want to run Bitcoin Core as a service? Create a systemd service file at /etc/systemd/system/bitcoind.service:

[Unit]
Description=Bitcoin Daemon
After=network.target

[Service]
User=<your-username>
ExecStart=/usr/bin/bitcoind -regtest -conf=/home/<your-username>/.bitcoin/bitcoin.conf
ExecStop=/usr/bin/bitcoin-cli -regtest stop
Restart=always
LimitNOFILE=1024

[Install]
WantedBy=multi-user.target

Reload and start the service:

sudo systemctl daemon-reload
sudo systemctl start bitcoind.service

Now Bitcoin Core runs automagically!

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

