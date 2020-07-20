## Versions
- Cluster version: `1.14.10-gke.36`
- kubectl version: `1.14`

All installation processes were performed using the Google Compute Engine and Google Kubernetes Engine, which are hosted by [Google Cloud Platform.](https://cloud.google.com/)

# Quick Install
> Based on [How To Install Jitsi Meet on Ubuntu 18.04](https://www.digitalocean.com/community/tutorials/how-to-install-jitsi-meet-on-ubuntu-18-04)

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

# Simple Cluster Setup
> Based on [Install guide for kubernetes](https://github.com/jitsi/docker-jitsi-meet/tree/master/examples/kubernetes)

**IMPORTANT:** Follow the Google SDK instructions in the main README before continuing. The Kubernetes CLI, `kubectl` will be used multiple times in this guide

This guide will create a single pod containing the four necessary containers to start a Jitsi setup: `jicofo`, `prosody`, `jvb`, and the `web` frontend

### Cluster Settings:
**Note:** These exact settings are not required to set up Jitsi on Kubernetes. However, they have proven to work when following this guide

- Zone: Choose something suitable
- Version: 1.14.10-gke.36
- Number of nodes: 1 (The setup only needs 1 node for now. You can enable autoscaling if you wish)
- Image type/OS: Ubuntu
- Machine type: n1-standard-2
- Access scopes (optional): Allow full access to all Cloud APIs
- Networking: Public cluster, enable HTTP load balancing (if you decide to use GCP's built in ingress controller)

Connect to the cluster using
```
gcloud container clusters get-credentials CLUSTER-NAME --zone ZONE --project PROJECT-ID
```

## 1. Create Jitsi namespace
```
kubectl create namespace jitsi
```
Switch namespaces by using
```
kubectl config set-context --current --namespace=NAMESPACE
```

## 2. Create Kubernetes secret
This step is optional, but the provided template is configured to retrive passwords/credentials from this secret file. It's easier and safer to just implement this. (Replace ... with your desired password)
```
kubectl create secret generic jitsi-config -n jitsi --from-literal=JICOFO_COMPONENT_SECRET=... --from-literal=JICOFO_AUTH_PASSWORD=... --from-literal=JVB_AUTH_PASSWORD=...
```

## 3. Deploy JVB UDP service
Jitsi uses WebRTC, which uses the UDP transport-layer protocol to communicate. (More info [here](comparitech.com/blog/vpn-privacy/udp-vs-tcp-ip/)). Copy the contents of "jvb-udp.yaml" and create a UDP service to expose the Jitsi Videobridge to the internet via port 30300.

**Note:** The port number can be changed, especially when you need multiple ports for multiple videobridges.

```
kubectl create -f jvb-udp.yaml
```

## 4. Deploy the main Jitsi pod
"deployment.yaml" will create the pod containing jicofo, prosody, jvb, and web. Change the `DOCKER_HOST_ADDRESS` value to the external IP of the LoadBalancer (jvb-udp) you created.

```
kubectl create -f deployment.yaml
```

## 5. Create an Ingress controller (optional)
With HTTP loadbalancing enabled, Kubernetes will default to its own Kubernetes Ingress Controller to handle the routing rules in your Ingress. However, we ran into problems when using the default setup, so we switched to an nginx-ingress controller instead.

To install the controller, use the package (aka "chart") manager, [Helm](https://helm.sh/)

**Note:** If you're on a windows machine, you should still be able to install Helm using [Chocolatey](https://chocolatey.org/). However, you can use Google Cloud Shell to follow along in Linux.

Connect to your cluster
```
gcloud container clusters get-credentials CLUSTER-NAME --zone ZONE --project PROJECT-ID
```

Install helm

```
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```
(At the time of writing, the Helm version is `v3.2.1`)

Install the `stable` repo
```
helm repo add stable https://kubernetes-charts.storage.googleapis.com/
```
Install the nginx-ingress controller
```
helm install my-nginx stable/nginx-ingress 
```
(At the time of writing, the chart version is `1.40.3` and the app version is `0.32.0`)

Point your DNS at the nginx-ingress controller's external IP and create an A record. You'll need this for passing the http-01-challenge in the Certbot section


## 6. TLS secret for certificate

Refer to the Certbot section for getting a certificate. Save the generated certificate into a `.pem` or `.crt` file and the key into a `.key` file.

```
kubectl create secret tls CERT_NAME --key KEY_FILE --cert CERT_FILE
```

**Note:** Go into "web-ingress.yaml" and change `secretName` to whatever you set `CERT_NAME` as.

## 7. Deploy the web service and Ingress
The web service listens on port 80 (HTTP) and port 443 (HTTPS). 

Fill in your hostname next to `hosts` and `host` in "web-ingress.yaml"
```
kubectl create -f web-service.yaml
kubectl create -f web-ingress.yaml
```

- If the Ingress shows an error for ClusterIP, change the type to NodePort by entering `type: NodePort` at the end of "web-service.yaml".
- If the Ingress doesn't resolve or complains about health checks, change the `servicePort` to `80` instead of `https`

The domain name should now direct you to the Jitsi Meet page. Make sure you can create meetings of 3+ people and see/hear the other users. The lock in the top left corner should also indicate that your certificate is valid.
- **Important:** Make sure you are using HTTPS and not HTTP, Jitsi only works over HTTPS (port 443).
- A common issue is video/audio being cut in meetings of 3 or more people. This means P2P (Peer-to-Peer) connection works, but the meeting cannot connect to the JVB. If this happens, make sure the DOCKER_HOST_ADDRESS field in "deployment.yaml" is pointing to the `jvb-udp` LoadBalancer's IP and not the ingress controller's IP
- [This example](https://github.com/jitsi/docker-jitsi-meet/tree/k8s-helm/k8s) is another way of setting up Jitsi on Kubernetes. We did run into problems with this version, namely a bug that kicked users out of meetings, so take care when implementing it.
- You can find container logs for jvb, jicofo, and prosody in /var/log/containers after you ssh into the node containing your Jitsi pod.


# Certbot
> [Certbot website](https://certbot.eff.org/)

You can use Certbot to get a renewable certificate from Let's Encrypt.

**Note:** The steps here are meant for installing Certbot without a running webserver. It will work with a webserver as well, but there are other versions of Certbot you can download in that case.

Preliminary steps:
```
	sudo apt-get update
	sudo apt-get install software-properties-common
	sudo add-apt-repository universe
	sudo add-apt-repository ppa:certbot/certbot
	sudo apt-get update
```

Install certbot
```
sudo apt-get install certbot
```
Make sure the domain name you're using is actually registered and has an A record for the ingress-controller's IP (Not the JVB UDP service's IP)

By default Certbot will use the http-01-challenge. If it throws an error (especially the ./well-known/acme challenge one), then you can use a DNS challenge instead. Run the following command and create a TXT record for your DNS. Copy in the output string from the challenge into the record and wait a bit for it to register before moving on. 

```
certbot certonly --manual --preferred-challenges dns -d DOMAIN-NAME
```

If Certbot still throws errors, refer to the cert-manager process in the README.

# Multi-JVB Setup
> Used extensively as reference: https://github.com/hpi-schul-cloud/jitsi-deployment

This setup deploys `jicofo`, `prosody`, and `web` in a single pod while JVB pods are deployed using statefulsets. A [metacontroller](https://metacontroller.app/examples/) (specifically the service-per-pod DecoratorController) is used to automatically assign NodePort services to each JVB pod. Startup scripts (ConfigMaps) are needed for this because the port numbers for each service must be different. Additionally, a [HorizontalPodAutoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) is used to add/delete pods depending on defined metrics.

**Note:** Follow the first two steps from Simple Cluster Setup.

**Important:** In order for the NodePort service to work, you must enable UDP ports (1-65535) for the cluster in the firewall rules. You also need to listen for a specific range of incoming IPs. Although it's not safe, you can temporarily make a rule to allow all UDP ports and a wide range of IPs (0.0.0.0/0 - 192.168.2.0/24) to test out the setup and change it later

### Cluster Settings:
**Note:** These exact settings are not required to set up Jitsi on Kubernetes. However, they have proven to work when following this guide

- Zone: Choose something suitable
- Version: 1.15.12-gke.6
- Number of nodes: 1 (The setup only needs 1 node for now. You can enable autoscaling if you wish)
- Image type/OS: Ubuntu
- Machine type: n1-standard-2
- Access scopes (optional): Allow full access to all Cloud APIs
- Networking: Public cluster, enable HTTP load balancing (if you decide to use GCP's built in ingress controller)

Connect to the cluster using
```
gcloud container clusters get-credentials CLUSTER-NAME --zone ZONE --project PROJECT-ID
```

## 1. Deploy the prosody service
```
kubectl create -f prosody-service.yaml
```
The service is LoadBalancer type, but NodePort might work.

## 2. Deploy the web service

Same web service from Simple Cluster Setup. Make sure to fill in your domain name and TLS secretfile for the `hosts` field and `tls-secret`, respectively.
```
kubectl create -f web-service.yaml
```
**IMPORTANT:** This setup was done with an nginx-ingress controller. Refer to the Simple Cluster Setup for the installation process. The nginx-ingress controller may also be replaced with an HAproxy version as well.

## 3. Jicofo, prosody, web deployment
```
kubectl create -f deployment.yaml
```
**Note:** The labels defined in both services and this deployment match so they are paired with one another. The XMPP_SERVER and XMPP_BOSH_URL_BASE fields also use "prosody" as the service name. Make sure the deployment is being exposed by the web service, prosody service, and ingress before moving on.

## 4. Install Metacontroller
> Refer to https://metacontroller.app/guide/install/

## 5. Add the DecoratorController
This controller looks for the pods deployed in the JVB statefulset via the `service-per-pod-label` annotation to add services to.
```
kubectl create -f service-per-pod-decoratorcontroller.yaml
```

## 6. Add the ConfigMaps

The entrypoint script is called by the JVB to get a port number that increments by 1 for each additional JVB pod, saving it to the JVB_PORT jitsi field. By default, the starting port is 30300. You can change this value for additional shards to avoid conflicting ports
```
kubectl create -f jvb-entrypoint.yaml
```
The shutdown script is meant to provide a graceful shutdown for JVB pods if they are being deleted or have been idle for too long. The JVB StatefulSet refers to this ConfigMap whenever it needs to shut down a pod
```
kubectl create -f jvb-shutdown.yaml
```
The service-per-pod script uses the DecoratorController from the previous step to add a NodePort service to each incoming JVB pod with the same port as defined in the entrypoint script. The `baseport` local variable is defined to be the default port 30300, so you must change this if you changed the BASE_PORT field in the entrypoint script.

```
kubectl create -f service-per-pod-hooks.yaml
```

**Note:** The setup created by [schul.cloud](https://github.com/hpi-schul-cloud/jitsi-deployment) was able to retrieve the JVB_PORT using two loops. However, it threw errors when we used it. The alternative, which is to maually define the `baseport` variable to match the JVB_PORT, works just as well. The only problem is that a new ConfigMap with a different `baseport` value is needed for each additional shard. The BASE_PORT in the entrypoint script must also be changed too.

## 7. Deploy and expose service-per-pod

A deployment is needed to detect incoming JVBs
```
kubectl create -f service-per-pod-deployment.yaml
```
**Note:** The service included in this file is of type LoadBalancer. NodePort would likely work as well.


## 8. Deploy the JVB StatefulSet
This version has been truncated and doesn't include the prometheus-exporter. Refer schul.cloud's setup's to see the unmodified StatefulSet
You can change the intial number of JVBs by changing the `replicas` field
```
kubectl create -f jvb-statefulset
```

## 9. Create the HorizontalPodAutoscaler
The default setup uses CPU and memory as the primary scaling metrics. (The resources in the JVB StatefulSet are set as such). However, The cluster's API version supports `autoscaling/v2beta2` which allows for new metrics
```
kubectl create -f jvb-hpa.yaml
```
Wait for it to load and make sure it is running with
```
kubectl describe jvb-hpa
```

If all goes well, deploying the JVB statefulset should have automatically added services exposing each JVB pod. Create a meeting with 3+ people to confirm that it works. If it does, refer to the Jitsi Meet Torture section to loadtest.

Otherwise, here are some common issues and solutions:

- If you change the service-per-pod-hooks ConfigMap at all, sometimes the service-per-pod deployment doesn't seem to register it. In this case, just delete the deployment and its service, add the new ConfigMap, and re-deploy the deployment/service.
- Make sure your pods and deployments are actually being exposed by their services. You can check by clicking into the pods/deployments and looking under "Exposing Services." If the section doesn't show anything, make sure your labels between pod/deployment and service match. As a quick reference...
	- Your "jitsi" deployment (with jicofo/prosody/web) should be exposed by the prosody, web, and ingress services. 
	- The jvb pods should be exposed by individual NodePort services.
	- The service-per-pod-deployment should be exposed by its corresponding service
- You can check the JVB port by creating a shell for your pod with
```
kubectl exec -it POD-NAME -- /bin/bash
```
The `printenv` command will list all of the pod's environment variables, of which JVB_PORT is a part of. However, its name will be different depending on the pod. If the 	pod's name is "jvb-0," it will be JVB_0_PORT. You can search for it by entering `printenv JVB_0_PORT`. Something like udp://IP_ADDRESS:PORT_NUMBER should appear. Another useful command is `compgen -A variable | grep "keyword"`, which will display the environment variables related to whatever you substitute for "keyword".
- Usually errors will appear in the service-per-pod-deployment's container logs. You can access them on the Google Cloud interface, or ssh into the node and navigate to /var/log/containers and look for the `service-per-pod` log (run as root).
- Make sure the service-per-pod deployment/service and service-per-pod-hooks ConfigMap are in the `metacontroller` namespace. Everything else should be in the `jitsi` namespace

---

# Jitsi-Meet-Torture

This is a loadtesting setup that uses [Selenium](https://www.selenium.dev/documentation/en/) to check the performance of conferences by automatically adding/removing fake users to conferences. The setup is done on **Google Chrome**.

**Note:** This part of the README assumes that you have a working Jitsi instance or cluster setup as outline in previous sections.

**Note:** This setup installs Maven through Ubuntu's `apt`. You can install [Maven on Windows](https://mkyong.com/maven/how-to-install-maven-in-windows/) as well. Alternatively, you can activate [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10) (WSL) and install [Ubuntu](https://ubuntu.com/tutorials/ubuntu-on-windows#1-overview) from the Microsoft Store.

You will also need [https://java.com/en/download/](https://java.com/en/download/) installed. Version 8 should be fine.

Download Selenium Server from https://www.selenium.dev/downloads/
- At the time of writing, the latest stable version is **3.141.59**

Move the .jar file to a folder of your choice

Open your terminal, navigate to your folder, and run:
```
java -jar selenium-server-standalone-3.141.59.jar -role hub
```
The last line will show something like: "Clients should connect to http://<ip-address>:4444/wd/hub" Remember this IP address.

Open another terminal window, navigate to your folder, and run:
```
java -Dwebdriver.gecko.driver="<path-to-folder>:\geckodriver.exe" -jar selenium-server-standalone-3.141.59.jar -role webdriver -hub http://<ip-address>:4444/grid/register -port 5566
```
Change `<path-to-folder>` to your folder's path and `<ip-address>` to the IP you recorded previously.

Check your Chrome version by clicking the three dots in the top right corner -> Help -> About Google Chrome. Remember what version you have (should be 80-84).

Download the Chrome driver from https://sites.google.com/a/chromium.org/chromedriver/downloads

Unzip the folder and move the chromedriver to your folder with the selneium .jar file.

Open another terminal window, navigate to your folder and run:
```
java -Dwebdriver.chrome.driver=./chromedriver -jar selenium-server-standalone-3.141.59.jar -role node -maxSession 1 -hub http://<ip-address>:4444/grid/register -browser browserName=chrome,version=80,platform=Linux,maxInstances=1
```

Install Maven
```
sudo apt install maven
```

If the single comand doesn't work, update your packages first
```
sudo apt-get install software-properties-common
sudo apt-add-repository universe
sudo apt-get update
sudo apt-get install maven
```

Clone the jitsi-meet-torture repository
```
git clone https://github.com/jitsi/jitsi-meet-torture
```
and navigate to the jitsi-meet-torture folder (should be where you cloned it)

Running the following command will start a couple conferences with fake callers for 2 minutes before closing them. Make sure to change the `--instance-url` option to your domain name. Change the `<ip-address>` to the one from earlier as well.
```
./scripts/malleus.sh --conferences=2 --participants=4 --senders=1 --audio-senders=2 --duration=120 --room-name-prefix=hamertesting --hub-url=http://<ip-address>:4444/wd/hub --instance-url=https://jitsi.dylantknguyen.com
```
