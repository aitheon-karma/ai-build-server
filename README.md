# Aitheon - Build Server

## Server Side Info
- routing library https://github.com/typestack/routing-controllers
- orm - mongosee

## Client Side info
- angular v7
- bootstrap v4.1
- ngx-bootstrap v3
- ngx-toastr

### 1. Setup cluster for developer
- `kubectl` setup required. [install kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/).
- Get package with credentials (3 files and sh script) from admin
- Download all files into one folder and navigate to this folder at console
- Run command

```
mv ./setup-cluster.txt ./setup-cluster.sh && chmod +x ./setup-cluster.sh && ./setup-cluster.sh
```


### 2. NPM config to work with private packages

Create a new "readonly" token, following "Working with tokens from the web" at  https://docs.npmjs.com/getting-started/working_with_tokens. 
Replace `00000000-0000-0000-0000-000000000000` below with your token and run it. 

To be able install packages you will need to run this command before each `npm install`

##### 2.0 Ask for a token from a team lead, if you don't have it

##### 2.1 Use an editor `vim` or `nano` and edit a `~/.profile` file
```
nano ~/.profile
```

##### 2.2 append following file with a correct token value
```
export NPM_TOKEN="00000000-0000-0000-0000-000000000000"
```

##### 2.3 Important! Full logout from ubuntu terminal

##### 2.4 Verify all correct
If result of below command is a token then you are good
```
echo $NPM_TOKEN
```

### 3. Install deps and create .env file
```
./init.sh
```

### 4. Run a MongoDB proxy
- Mongo will run on a default port. 
- Mongodb connection string is at .env file. But it will be loaded when app starts
```
./proxy-db.sh
```

### Run client side
```
npm run client:watch
```

### Run Server side
```
npm run debug && npm start
```
Or you can use a VS code to run a server

###### Cleanup node modules
```
rm -rf node_modules client/node_modules package-lock.json client/package-lock.json
npm cache clear --force
```


##### New workflow to start

1. Run server
1.1 To verify all is good, it generates server/docs/swagger.json
API documentation address
http://localhost:3000/api-docs

2. Install Docker
2.1 Add docker permission (for Ubuntu)
    Run this command and then completely log out of your account and log back in (if in doubt, reboot!)
    ```
    'sudo usermod -a -G docker $USER'
    ```

3. Generate REST Client code. script will generate services code and put it to `projects/aitheon/{projectName}/src/lib/rest`. 
Run Rest lib generator. 
```
npm run core:generate-rest && npm run client:lib:watch
```

4. Wait step 2 compiled or you will get error. Then Run Client lib
```
npm run client:watch
```

5. Optional. Documentation for Rest library. All generated models and rest services you can check also at `projects/aitheon/{projectName}/src/lib/rest`
```
cd client && npm run docs
```
Documentation for Rest Library
http://localhost:3000/docs


// admin flow

kubectl create secret generic aws-secret --from-file=$PWD/keys/credentials --namespace=ai-build-server
kubectl create configmap credconfig --from-file=$PWD/server/assets/config.json --namespace=ai-build-server
kubectl create secret generic ssh-git-aitheon --from-file=$PWD/keys/aitheon/id_rsa --from-file=$PWD/keys/aitheon/id_rsa.pub --namespace=ai-build-server
kubectl create secret generic ssh-github --from-file=$PWD/keys/github/id_rsa --from-file=$PWD/keys/github/id_rsa.pub --namespace=ai-build-server
kubectl create secret generic npmconfig --from-literal=token=e607727a-50a6-4c72-aad7-7ebdec2fac58 --namespace=ai-build-server

// add password
kubectl create secret generic ai-build-server --from-literal=KUBERNETES_SERVICE_USERNAME=admin --from-literal=KUBERNETES_SERVICE_PASSWORD=d4wKtSwj0LRol1yg0QD8B2vHufpuj52p --namespace=ai-build-server

kubectl create secret generic npmconfig --from-literal=token=e607727a-50a6-4c72-aad7-7ebdec2fac58 --namespace=ai-creators-studio

kubectl create secret generic db-config --from-literal=MONGODB_URI=mongodb://fedoralabs:dqgfmZovYdtqV9Rq3ZEf@ai-mongo.ai-mongo.svc.cluster.local:27017/isabel?authSource=admin --namespace=ai-build-server




// Create logs user
NAMESPACE=ai-creators-studio
NAMESPACE=ai-build-server
kubectl delete secret logs-config -n $NAMESPACE
kubectl create secret generic logs-config --from-literal=LOGS_MONGODB_URI=mongodb://logs:K3epHpwmpTxwuNhJSybN@ai-mongo.ai-mongo.svc.cluster.local:27017/projects-logs?authSource=admin -n ai-build-server



kubectl exec -it ai-mongo-0 /usr/bin/mongo -n ai-mongo
db.getSiblingDB("admin").auth("fedoralabs", "dqgfmZovYdtqV9Rq3ZEf");
use admin
 db.adminCommand({ createRole: "logsWriter",
  privileges: [
    { resource: { db: "projects-logs", collection: "fedoralabs__logs" }, actions: [ "insert" ] }
  ],
  roles: [
  ]
})
db.createUser({ user: "logs", pwd: "K3epHpwmpTxwuNhJSybN", roles: [ "logsWriter"] })


db.adminCommand({ removeRole: "logsWriter"})

 
 //deploy test