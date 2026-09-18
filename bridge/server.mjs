        // The camera, which unlike everything else here has to ask and wait.
        jarvis_eyes: visionServer(ask),
        // TITAN Commerce OS is the durable business/runtime layer. JARVIS remains the executive face and voice; this server is the narrow authenticated bridge between them.
        titan: titanServer(),
      },