## Versions
- Cluster version: `1.14.10-gke.36`
- kubectl version: `1.14`

This installation process performed using the Google Compute Engine and Google Kubernetes Engine, which are hosted by [Google Cloud Platform.](https://cloud.google.com/)

# Quick Install
> Based on https://www.digitalocean.com/community/tutorials/how-to-install-jitsi-meet-on-ubuntu-18-04

**Note:** All calls to `nano` can be replaced by `vim` or another text editor of your choice 

## 1. Make a VM instance
- Zone: Choose something suitable
- Machine Type: n1-standard-2
- Boot Disk/OS: Ubuntu (18.04 LTS)
- Firewall: Allow http/https
- Access Scopes (Optional): Allow full access to all Cloud APIs

**Important:** Make sure you have an A record for the DNS you will be using. Point the domain name at the VM instance's external IP when making the record.

## 2. Set up hostname
ssh into the VM instance you created. Then, run
```
sudo hostnamectl set-hostname YOUR-DOMAIN
```
and then 
```
hostname
```
Your domain name should be displayed 

## 3. Set domain name
Run
```
sudo nano /etc/hosts
```
Change the top line to `127.0.0.1 YOUR-DOMAIN`. Alternatively, adding this line under the existing one should be fine too.

Exit the file and run `ping YOUR-DOMAIN` to check

## 4. Set up firewall
For this step, we'll use the ufw package. Install using
```
sudo apt install ufw
```
Open ports 80, 443, 4443, and 10000
```
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 4443/tcp
sudo ufw allow 10000/udp
sudo ufw enable
```
Check with
```
sudo ufw status
```
## 5. Install Jitsi Meet
Get the key to install Jitsi Meet
```
wget https://download.jitsi.org/jitsi-key.gpg.key
sudo apt-key add jitsi-key.gpg.key
```
You can remove the key after
```
rm jitsi-key.gpg.key
```
Create source file
```
sudo nano /etc/apt/sources.list.d/jitsi-stable.list
```
and add the Jitsi repository on the first line
```
deb https://download.jitsi.org stable/
```
Install Jitsi Meet
```
sudo apt update
sudo apt install jitsi-meet
```
Enter your domain name when prompted

Choose self-signed certificate (first option) for now. The next step will handle the TLS certificate

## 6. TLS certificate with Let's Encrypt
Jitsi's quick install comes with a Let's Encrypt script. Again, make sure you have an A record for your DNS pointing at the VM instance's IP address

Install certbot. 
```
sudo apt-get install software-properties-common
sudo add-apt-repository ppa:certbot/certbot
```
Run Jitsi's script. *Note: The script will ask for an email address.*
```
sudo /usr/share/jitsi-meet/scripts/install-letsencrypt-cert.sh
```
If you see the "Congratulations" message, you're good to go. Otherwise, refer to the Certbot section of the README

Since Jitsi Meet uses port 443 (https), you're free to delete port 80, which was used during the certificate process
```
sudo ufw delete allow 80/tcp
```

# Creating an Instance Group
After creating a standalone Jitsi instance via the Quick Install guide, it is possible make copies using GCP's instance template feature. This allows you to create an **instance group** that will make new instances based on your existing Jitsi one.

**Note:** All of the tools used in this procedure are in the Google Compute Engine

1. Start by creating a **snapshot** of the Jitsi instance. Choose the instance as your source disk.
2. Create an **image** from the snapshot. Change the source to "Snapshot" and choose the snapshot you created

    (You can also create the image from command line using)
    ```
    gcloud compute images create IMAGE-NAME --source snapshot SNAPSHOT-NAME --storage-location REGION-NAME
    ```
3. Create a **template** from the image. Change the machine type to match the original instance's and change the boot disk to your custom image.
4. Create an **instance group** using the template you created.

# Cluster Setup
