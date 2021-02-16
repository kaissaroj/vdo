function $imarkVideo() {
  this.methods = {};
  this.thirdPartyJS = [
    "https://webrtc.github.io/adapter/adapter-latest.js",
    "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.3.1/peerjs.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/socket.io/3.1.1/socket.io.js",
  ];
  this.myStream = false;
  this.mic_switch = true;
  this.video_switch = true;
  this.videoContainer = [];
  this.room = null;
  this.domSelectorId = {
    me: null,
    other: null,
  };
  this.settings = {};
  this.myPeer = null;
  this.socket = null;
  this.peers = [];
  this.myUserData = {};

  this.pullJS = (callback) => {
    for (let i = 0; i < this.thirdPartyJS.length; i++) {
      var _file = this.thirdPartyJS[i];
      Helpers()
        .injectScript(_file)
        .then(() => {
          if (i == this.thirdPartyJS.length - 1) {
            setTimeout(() => {
              callback();
            }, 10);
          }
        })
        .catch(function (error) {
          throw Error(error);
        });
    }
  };
  this.initializeSocketEvents = () => {
    this.socket.on("connect", () => {
      console.log("socket connected");
    });
    this.socket.on("user-disconnected", (userID) => {
      console.log("user disconnected-- closing peers", userID);
      this.peers[userID] && this.peers[userID].close();
      Helpers().removeVideo(
        userID,
        this.videoContainer,
        (updatedVideoContainer) => {
          this.videoContainer = updatedVideoContainer;
        }
      );
    });
    this.socket.on("disconnect", () => {
      console.log("socket disconnected --");
    });
    this.socket.on("error", (err) => {
      console.log("socket error --", err);
    });
  };
  this.initializePeersEvents = () => {
    this.myPeer.on("open", (id) => {
      myID = id;
      const roomID = this.room;
      const userData = {
        userID: id,
        roomID,
      };
      console.log("peers established and joined room", userData);
      this.setNavigatorToStream(userData);
    });
    this.myPeer.on("error", (err) => {
      console.error("peer connection error", err);
      this.myPeer.reconnect();
    });
  };
  this.setPeersListeners = (stream) => {
    this.myPeer.on("call", (call) => {
      console.log("----peer---- answered ", call.metadata.id);
      call.answer(stream);
      call.on("stream", (userVideoStream) => {
        console.log(" ---- user incoming stream --- ", userVideoStream);
        Helpers().createVideo(
          { id: call.metadata.id, stream: userVideoStream },
          this.domSelectorId.other,
          false,
          this.videoContainer,
          (updatedVideoContainer) => {
            this.videoContainer = updatedVideoContainer;
          }
        );
      });
      call.on("close", () => {
        console.log("closing peers listeners", call.metadata.id);
        Helpers().removeVideo(
          call.metadata.id,
          this.videoContainer,
          (updatedVideoContainer) => {
            this.videoContainer = updatedVideoContainer;
          }
        );
      });
      call.on("error", () => {
        console.log("peer error ------");

        Helpers().removeVideo(
          call.metadata.id,
          this.videoContainer,
          (updatedVideoContainer) => {
            this.videoContainer = updatedVideoContainer;
          }
        );
      });
      this.peers[call.metadata.id] = call;
    });
  };
  this.setNavigatorToStream = async (userData) => {
    this.myStream = await Helpers().getVideoAudioStream();
    this.myUserData = userData;
    if (this.myStream) {
      this.socket.emit("join-room", userData);
      Helpers().createVideo(
        { id: userData?.userID, stream: this.myStream },
        this.domSelectorId.me,
        true,
        this.videoContainer,
        (updatedVideoContainer) => {
          this.videoContainer = updatedVideoContainer;
        }
      );
      this.setPeersListeners(this.myStream);
      this.newUserConnection(this.myStream);
    }
  };
  this.newUserConnection = (stream) => {
    this.socket.on("new-user-connect", (userData) => {
      console.log("New User Connected", userData);
      this.connectToNewUser(userData, stream);
    });
  };
  this.connectToNewUser = (userData, stream) => {
    const { userID } = userData;
    console.log("=====connectToNewUser=====", userID);
    const call = this.myPeer.call(userID, stream, { metadata: { id: myID } });
    console.log("get ---- call ------");
    call.on("stream", (userVideoStream) => {
      console.log("connectToNewUser ---- stream ------", stream);
      Helpers().createVideo(
        { id: userID, stream: userVideoStream, userData },
        this.domSelectorId.other,
        false,
        this.videoContainer,
        (updatedVideoContainer) => {
          this.videoContainer = updatedVideoContainer;
        }
      );
    });
    call.on("close", () => {
      console.log("closing new user", userID);

      Helpers().removeVideo(
        userID,
        this.videoContainer,
        (updatedVideoContainer) => {
          this.videoContainer = updatedVideoContainer;
        }
      );
    });
    call.on("error", () => {
      console.log("peer error ------");
      Helpers().removeVideo(
        userID,
        this.videoContainer,
        (updatedVideoContainer) => {
          this.videoContainer = updatedVideoContainer;
        }
      );
    });
    this.peers[userID] = call;
  };

  this.methods.init = (
    {
      room = "",
      video = true,
      audio = true,
      videoSettings = {},
      meSelectorid,
      otherSelectorid,
    },
    callback
  ) => {
    try {
      this.room = room;
      this.domSelectorId = {
        me: meSelectorid,
        other: otherSelectorid,
      };

      this.settings = {
        video: video,
        audio: audio,
        videoSettings:
          typeof videoSettings === "object" &&
          Object.values(videoSettings).length
            ? videoSettings
            : {
                frameRate: 12,
                noiseSuppression: true,
                width: { min: 640, ideal: 640, max: 640 },
                height: { min: 480, ideal: 640, max: 640 },
              },
      };
      this.pullJS(callback);
    } catch (e) {
      throw Error(e);
    }
  };
  // this.methods.streamMyVideo = async () => {
  //   this.myStream = await Helpers().getVideoAudioStream();
  //   Helpers().createVideo(
  //     { id: this.domSelectorId.me, stream: this.myStream },
  //     this.videoContainer,
  //     this.domSelectorId.me,
  //     function (updatedVideoContainer) {
  //       // this.videoContainer = updatedVideoContainer;
  //     }
  //   );
  // };
  this.methods.start = () => {
    this.myPeer = Helpers().initializePeerConnection();
    this.socket = Helpers().initializeSocketConnection();
    this.initializeSocketEvents();
    this.initializePeersEvents();
  };
  this.methods.toggleMic = (callback = {}) => {
    if (this.myStream != null && this.myStream.getAudioTracks().length > 0) {
      this.mic_switch = !this.mic_switch;
      this.myStream.getAudioTracks()[0].enabled = this.mic_switch;
      typeof callback === "function" && callback(this.mic_switch);
    }
  };
  this.methods.toggleVideo = (callback = {}) => {
    if (this.myStream != null && this.myStream.getVideoTracks().length > 0) {
      this.video_switch = !this.video_switch;
      this.myStream.getVideoTracks()[0].enabled = this.video_switch;
      typeof callback === "function" && callback(this.video_switch);
    }
  };
  this.methods.leave = () => {
    const { userID } = this.myUserData;
    Helpers().removeVideo(
      userID,
      this.videoContainer,
      (updatedVideoContainer) => {
        this.videoContainer = updatedVideoContainer;
      }
    );
    this.socket.disconnect();
    this.peers[userID] && this.peers[userID].close();
  };
  this.methods.reconnect = () => {
    this.myPeer = Helpers().initializePeerConnection();
    this.socket = Helpers().initializeSocketConnection();
    this.initializeSocketEvents();
    this.initializePeersEvents();
  };

  return this.methods;
}
function Helpers() {
  var injectScript = function (src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", resolve);
      script.addEventListener("error", (e) => reject(e.error));
      document.head.appendChild(script);
    });
  };
  var getVideoAudioStream = async (
    video = true,
    audio = true,
    videoSettings = null
  ) => {
    let quality = 12;
    const myNavigator = await navigator.mediaDevices.getUserMedia({
      video: video
        ? {
            frameRate: quality ? quality : 12,
            noiseSuppression: true,
            width: { min: 640, ideal: 640, max: 640 },
            height: { min: 480, ideal: 640, max: 640 },
          }
        : false,
      audio: audio,
    });
    return myNavigator;
  };

  var createVideo = function (
    createObj,
    parentId,
    isMe,
    videoContainer,
    callback
  ) {
    if (!videoContainer[createObj.id]) {
      videoContainer[createObj.id] = {
        ...createObj,
      };
      const roomContainer = document.getElementById(parentId);
      const video = document.createElement("video");
      video.srcObject = videoContainer[createObj.id].stream;
      video.id = createObj.id;
      video.autoplay = true;
      if (isMe) video.muted = true;
      roomContainer.append(video);
    } else {
      if (!!document.getElementById(createObj.id))
        document.getElementById(createObj.id).srcObject = createObj.stream;
    }
    callback(videoContainer);
  };
  var removeVideo = function (id, videoContainer, callback) {
    delete videoContainer[id];
    const video = document.getElementById(id);
    if (video) video.remove();
    callback(videoContainer);
  };
  var initializePeerConnection = () => {
    const params = {
      secure: true,
      iceTransportPolicy: "all",
      host: "imarkpeerserver.herokuapp.com",
      port: 443,
      config: {
        iceServers: [
          { urls: ["stun:bn-turn1.xirsys.com"] },
          {
            username: "imark",
            credential: "imark@123",
            urls: ["turn:134.209.145.160:3478"],
          },
        ],
      },
    };

    return new Peer(params);
  };
  var initializeSocketConnection = () => {
    var URL = "https://herokuvserver.herokuapp.com/";
    return io.connect(URL, { forceNew: true });
  };
  return {
    injectScript,
    getVideoAudioStream,
    createVideo,
    removeVideo,
    initializePeerConnection,
    initializeSocketConnection,
  };
}
