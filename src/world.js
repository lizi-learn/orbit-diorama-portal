import {Engine,THREE,normalize,prepModel,damp,studioEnvironment} from './core/engine.js';
import {Assets} from './core/assets.js';
import {fbmTexture,fbmNormal} from './core/textures.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
export async function createWorld({capture=false}={}){
 const canvas=document.querySelector('#space-canvas');
 const engine=new Engine({canvas,fov:35,dpr:capture?1.5:Math.min(devicePixelRatio,1.5),alpha:true,background:null,shadows:true,post:{ao:innerWidth<800?false:{aoRadius:.6,intensity:1.5,distanceFalloff:.6,aoSamples:8,denoiseSamples:4},bloom:{intensity:.35,luminanceThreshold:1.8,luminanceSmoothing:.3},tone:'agx',noise:false,vignette:false,smaa:true}});
 const {scene,renderer,camera}=engine;
 scene.environment=studioEnvironment(renderer,{top:0x435c73,bottom:0x090f1b,panels:[{pos:[-5,7,5],size:[6,8],intensity:4.5,color:0xffe8d5},{pos:[5,4,-4],size:[4,7],intensity:2.8,color:0x9bc9f7},{pos:[0,3,7],size:[6,5],intensity:.6,color:0xb6cbdc}]});scene.environmentIntensity=.65;
 const hemi=new THREE.HemisphereLight('#6686a4','#0a0e18',.7);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff1df',4.5);sun.position.set(-5,8,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:9,bottom:-5,near:.1,far:40});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
 const rim=new THREE.DirectionalLight('#6fa7de',2.8);rim.position.set(5,5,-5);scene.add(rim);
 const fill=new THREE.DirectionalLight('#b1c5da',.5);fill.position.set(3,3,8);scene.add(fill);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(5.4,96,64),new THREE.MeshStandardMaterial({map:fbmTexture(renderer,{size:512,scale:8,octaves:7,contrast:.9,bias:.6}),normalMap:fbmNormal(renderer,{size:512,scale:14,octaves:6,strength:3.5}),normalScale:new THREE.Vector2(.4,.4),color:0x9da0a5,roughness:.97,metalness:0}));moon.position.set(0,-5.3,0);moon.receiveShadow=true;moon.material.normalMap.repeat.set(5,4);moon.material.map.repeat.set(3,2);scene.add(moon);
 const starGeo=new THREE.BufferGeometry();const starPos=[];let seed=16;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};for(let i=0;i<260;i++)starPos.push((rand()-.5)*60,rand()*30-4,-14-rand()*20);starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc2d2df,size:.035,transparent:true,opacity:.6,sizeAttenuation:true}));scene.add(stars);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(4.1,.006,8,180),new THREE.MeshBasicMaterial({color:0x7594ac,transparent:true,opacity:.28}));ring.rotation.x=Math.PI*.39;ring.rotation.y=-.25;ring.position.set(0,2,-3);scene.add(ring);
 const assets=new Assets(p=>{const el=document.querySelector('#load-value');if(el)el.textContent=Math.min(99,Math.round(p*100))+'%';});
 const g=await assets.gltf('models/astronaut.glb');const astro=g.scene;normalize(astro,5.2,{ground:true,axis:'y'});astro.position.y+=.1;prepModel(astro,renderer,{metal:0});
 astro.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
float gr=diffuseColor.g/max(diffuseColor.r,0.001);
float visor=step(0.57,gr)*step(gr,0.89)*smoothstep(0.055,0.14,diffuseColor.r-diffuseColor.b)*step(0.07,diffuseColor.r);
metalnessFactor=max(metalnessFactor,visor*0.88);
roughnessFactor=mix(max(roughnessFactor,0.5),0.16,visor);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.91,0.65,0.28),visor*0.5);`);};}});
 const root=new THREE.Group();root.add(astro);scene.add(root);root.rotation.y=-.3;
 const scan=new THREE.Group();astro.traverse(o=>{if(o.isMesh){const mesh=new THREE.Mesh(o.geometry,new THREE.MeshBasicMaterial({color:0x81e4e3,wireframe:true,transparent:true,opacity:.13,depthWrite:false}));o.updateWorldMatrix(true,false);mesh.matrix.copy(root.matrixWorld).invert().multiply(o.matrixWorld);mesh.matrixAutoUpdate=false;scan.add(mesh);}});scan.scale.setScalar(1.003);scan.visible=false;root.add(scan);
 const scanner=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshBasicMaterial({color:0x5fe3e0,transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}));scanner.rotation.x=-Math.PI/2;scanner.visible=false;root.add(scanner);
 let angle=-.3,targetAngle=-.3,orbit=false,mode=0,visible=true,dragging=false,lastX=0,pointerY=0;
 const camPos=new THREE.Vector3(0,3.5,14.8),camLook=new THREE.Vector3(0,2.25,0),wantPos=camPos.clone(),wantLook=camLook.clone();
 camera.position.copy(camPos);camera.lookAt(camLook);
 if(!capture){new IntersectionObserver(e=>{visible=e[0].isIntersecting;engine.paused=!visible;},{threshold:0}).observe(canvas);}
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;dragging=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(dragging){targetAngle+=(e.clientX-lastX)*.007;lastX=e.clientX;}});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
 let tx=0,ty=0;canvas.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});canvas.addEventListener('touchmove',e=>{const dx=e.touches[0].clientX-tx,dy=e.touches[0].clientY-ty;if(Math.abs(dx)>Math.abs(dy)){targetAngle+=dx*.008;tx=e.touches[0].clientX;}},{passive:true});
 engine.onTick((dt,t)=>{if(!visible)return;if(orbit&&!reduced)targetAngle+=dt*.18;angle=damp(angle,targetAngle,5,dt);root.rotation.y=angle;root.position.y=reduced?0:Math.sin(t*.45)*.025;const mobile=canvas.clientWidth<700;const dist=mobile?15.3:14.8;
 if(mode===1){wantPos.set(.25,4.05,6.65);wantLook.set(0,3.95,0);}else{wantPos.set(0,3.5,dist);wantLook.set(0,2.25,0);}camPos.lerp(wantPos,1-Math.exp(-3*dt));camLook.lerp(wantLook,1-Math.exp(-3*dt));camera.position.copy(camPos);camera.lookAt(camLook);scanner.position.y=reduced?2.7:(Math.sin(t*.85)*.5+.5)*5.1;scan.children.forEach(m=>{m.material.opacity=.1+(reduced?.02:Math.sin(t*2.1)*.035);});ring.rotation.z=reduced?0:t*.012;});
 renderer.compile(scene,camera);engine.start();document.querySelector('#scene')?.classList.add('ready');document.querySelector('#capture-status')?.setAttribute('data-ready','true');
 return {setView(i){mode=i;scan.visible=i===2;scanner.visible=i===2;},toggleOrbit(){orbit=!orbit;return orbit;},reset(){targetAngle=-.3;},engine};
}
