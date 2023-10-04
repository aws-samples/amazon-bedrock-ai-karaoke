import React, { useState, useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import ContentLayout from "@cloudscape-design/components/content-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Badge from "@cloudscape-design/components/badge";
import Grid from "@cloudscape-design/components/grid";
import { AppLayout, HelpPanel } from '@cloudscape-design/components';
import LoadingIcons from 'react-loading-icons'

import './styles.css';

export const WebSocketDemo = () => {
//   Python server running on localhost
  const [socketUrl, setSocketUrl] = useState('ws://127.0.0.1:8765');
  const didUnmount = useRef(false);

  const [websocketOpen, setWebsocketOpen] = useState(false)
  const [internet, setInternet ] = useState("")
  const [myState, setMyState ] = useState('State.INITIALIZING')
  const [myModel, setMyModel ] = useState("")
  const [myPrompt, setMyPrompt ] = useState("Hello _ World")
  const [myResultA, setMyResultA ] = useState("")
  const [myResultB, setMyResultB ] = useState("")

  const [myError, setMyError ] = useState("")

  const [micOn, setMicOn] = useState(false)

  const targetSubstr = '_';
  const startIndex = myPrompt.indexOf(targetSubstr);
  const endIndex = startIndex + targetSubstr.length;
  const [colorIndex, setColorIndex] = useState(0);
  const rainbowColors = ['#FFCA50', '#41A7D3', '#2DBBAA', '#A5519F', '#F05C76'];

  useEffect(() => {
    const timer = setInterval(() => {
      setColorIndex((prevIndex) => (prevIndex + 1) % rainbowColors.length);
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);
  
  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(socketUrl, {
      onOpen: () => {
        setWebsocketOpen(true)
        console.log("Connected!")
      },
      onClose: () => {
        setWebsocketOpen(false)
        console.log("Disconnected!")
      },
      // New onMessage handler
      onMessage: (e) => {
          const data = JSON.parse(e.data)
          setMyModel(data.model)
          setMyPrompt(data.prompt)
          setMyResultA(data.result_a)
          setMyResultB(data.result_b)
          setMyState(data.state)


          if (data.state == 'State.ERROR') {
            setMyError(data.error)
          }

          if (myState == "State.TRANSCRIBING") {
            setMicOn(true)
          } else {
            setMicOn(false)
          }          
          // console.log(data)
      },
      retryOnError: true,
      shouldReconnect: (closeEvent) => {
        console.log(closeEvent)
        return true;
      },
      reconnectAttempts: 1000,
      reconnectInterval: 5000,
  });

  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);

  const handleSelectA = useCallback(() => {
    console.log("Clicked on A")
    sendMessage("A");
  }, [sendMessage]);

  const handleSelectB = useCallback(() => {
    console.log("Clicked on B")
    sendMessage("B");
  }, [sendMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return (
    <AppLayout
    toolsOpen
    navigationOpen
    navigationWidth={300}
    toolsWidth={300}
    tools={
      <HelpPanel header={<h2>Architecture</h2>}>
        <img src="ai_karaoke_arch.png" style={{width: '100%'}}/>
        <br/>
        <br/>
        <br/>
        <font style={{color: 'black', fontSize: '80%'}}>Scan the QR code below to visit</font>
        <br/>
        <font style={{color: 'black', fontSize: '60%'}}>https://github.com/aws-samples/amazon-bedrock-ai-karaoke</font>
        <img src="qr.png" style={{width: '50%'}}/>
      </HelpPanel>
    }
    navigation={
      <HelpPanel>
        <img src="logo.png" style={{width: '100%'}}/>
        <img src="logo.png" style={{width: '100%'}}/>
        <img src="logo.png" style={{width: '100%'}}/>
        <img src="logo.png" style={{width: '100%'}}/>
      </HelpPanel>
    }
    content={

    <ContentLayout
      disableOverlap
      header={
          <Header
            variant="h1"
            description="Complete the karaoke prompt with the microphone and choose the best response.
            Powered by Amazon Bedrock and Amazon Transcribe.
            This app is deployed to a Raspberry Pi edge device using Amazon ECS Anywhere.
            Please visit https://github.com/aws-samples/amazon-bedrock-ai-karaoke for the code and more infomation."
            
            actions={
              <div>
              With ❤️ from AWS &nbsp;
              <img style={{float:'right', background:'grey', height: 40}} src={"proto.png"}></img>
              </div>
            }
          > 
            Amazon Bedrock AI Karaoke
          </Header>
          
      }
    >
    <SpaceBetween size="xs">
    <Container>

    {
        {
          true: <Badge color="green">WebSocket</Badge>,
          false: <Badge color="red">WebSocket</Badge>
        }[websocketOpen]
    }
    {
        {
          true: <Badge color="green">WebSocket</Badge>,
          false: <Badge color="red">WebSocket</Badge>
        }[internet]
    }
    {
        {
          'claude': <Badge color="grey">Model: Anthropic Claude v2</Badge>,
          'sdxl': <Badge color="grey">Model: Stable Diffusion XL 0.8</Badge>
        }[myModel]
    }
    <Badge >Time: {parseInt(Date.now() / 1000)}</Badge>
    <Badge >{myState}</Badge>
    </Container>
    <Container
      header={
        <Header variant="h2">
          <font color="#539fe5">Prompt:</font>
          <br />
          
          {myPrompt.split('').map((char, index) => (
            <span
              key={index}
              style={{
                backgroundColor: (index >= startIndex && index < endIndex) ? rainbowColors[colorIndex] : 'transparent',
                opacity: 0.8,
              }}
            >
              {char}
            </span>
          ))}
          <br/>
        </Header>
      }
    >
    </Container>

      <Container
        header={
          <Header
            variant="h2"
          >
            <font color="#539fe5">Push the color button corresponding to the best response:</font>
            
          </Header>
        }
      >
<Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>

{(() => {
  const commonStyles = { padding: '10px', margin: '5px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' };
  const centerIconStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: '0', right: '0', bottom: '0', left: '0' };
  const wrapperStyle = { position: 'relative' };
  
  const styles = {
    'State.ERROR': <div style={{ ...commonStyles, color: 'red' }}>{myError}</div>,
    'State.INITIALIZING': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>{myResultA}</div>,
    'State.TRANSCRIBING': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>{myResultA}</div>,
    'State.REVIEW_TXT': <div onClick={handleSelectA} style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>{myResultA}</div>,
    'State.REVIEW_IMG': <div onClick={handleSelectA} style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultA}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>,
    'State.INFERENCE_TXT_A': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>{myResultA}</div>,
    'State.INFERENCE_TXT_B': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>{myResultA}</div>,
    'State.INFERENCE_IMG_A': <LoadingIcons.BallTriangle fill="red" stroke="red" />,
    'State.INFERENCE_IMG_B': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultA}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>,
    'State.SELECT_A_IMG': 
    <div style={wrapperStyle}>
      <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultA}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>
      <div style={centerIconStyle}><LoadingIcons.Puff height={400} width={400} fill="white" stroke="white" speed={0.3} /></div>
    </div>,
    'State.SELECT_B_IMG':  <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultA}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>,
    'State.SELECT_A_TXT': 
    <div style={wrapperStyle}>
      <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white' }}>{myResultA}</div>
      <div style={centerIconStyle}><LoadingIcons.Puff height={400} width={400} fill="white" stroke="white" speed={0.3} /></div>
    </div>,
    'State.SELECT_B_TXT': <div style={{ ...commonStyles, backgroundColor: 'red', color: 'white', opacity: 0.3 }}>{myResultA}</div>,
  };

  return styles[myState];
})()}

{(() => {
  const commonStyles = { padding: '10px', margin: '5px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' };
  const centerIconStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: '0', right: '0', bottom: '0', left: '0' };
  const wrapperStyle = { position: 'relative' };

  const styles = {
    'State.ERROR': <div style={{ ...commonStyles, color: 'red' }}>{myError}</div>,
    'State.INITIALIZING': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.TRANSCRIBING': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.REVIEW_IMG': <div onClick={handleSelectB} style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultB}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>,
    'State.REVIEW_TXT': <div onClick={handleSelectB} style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.INFERENCE_TXT_A': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.INFERENCE_TXT_B': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.INFERENCE_IMG_A': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>{myResultB}</div>,
    'State.INFERENCE_IMG_B': <LoadingIcons.BallTriangle fill="blue" stroke="blue" />,
    'State.SELECT_A_IMG': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultB}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>,
    'State.SELECT_B_IMG': 
    <div style={wrapperStyle}>
      <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.8 }}>
      <img src={`data:image/png;base64,${myResultB}`} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="description" /></div>
      <div style={centerIconStyle}><LoadingIcons.Puff height={400} width={400} fill="white" stroke="white" speed={0.3} /></div>
    </div>,
    'State.SELECT_A_TXT': <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white', opacity: 0.3 }}>{myResultB}</div>,
    'State.SELECT_B_TXT': 
    <div style={wrapperStyle}>
      <div style={{ ...commonStyles, backgroundColor: 'blue', color: 'white' }}>{myResultB}</div>
      <div style={centerIconStyle}><LoadingIcons.Puff height={400} width={400} fill="white" stroke="white" speed={0.3} /></div>
    </div>,
  };

  return styles[myState];
})()}
</Grid>


      </Container>
      </SpaceBetween>
    </ContentLayout>
    }
    ></AppLayout>
  );
};

export default WebSocketDemo;