import { TextureLoader, WebGLRenderTarget, Object3D, LinearFilter, Vector2 } from "three"
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { Canvas, useLoader, useThree, useFrame } from "react-three-fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import BackfaceMaterial from "./backface-material"
import RefractionMaterial from "./refraction-material"
import diamondUrl from "./assets/diamond.glb"
import textureUrl from "./assets/py.png"
import "./styles.css"



function Background() {
  const { viewport, aspect } = useThree()
  const texture = useLoader(TextureLoader, textureUrl)
  useMemo(() => (texture.minFilter = LinearFilter), [])
  // Calculates a plane filling the screen similar to background-size: cover
  const adaptedHeight = 3800 * (aspect > 5000 / 3800 ? viewport.width / 5000 : viewport.height / 3800)
  const adaptedWidth = 5000 * (aspect > 5000 / 3800 ? viewport.width / 5000 : viewport.height / 3800)
  return (
    <mesh layers={1} scale={[adaptedWidth, adaptedHeight, 1]}>
      <planeBufferGeometry attach="geometry" />
      <meshBasicMaterial attach="material" map={texture} depthTest={true} />
    </mesh>
  )
}

function Diamonds() {
  const { size, viewport, gl, scene, camera, clock } = useThree()
  const model = useRef()
  const gltf = useLoader(GLTFLoader, diamondUrl);
  // Create Fbo's and materials
  const [envFbo, backfaceFbo, backfaceMaterial, refractionMaterial] = useMemo(() => {
    const envFbo = new WebGLRenderTarget(size.width, size.height)
    const backfaceFbo = new WebGLRenderTarget(size.width, size.height)
    const backfaceMaterial = new BackfaceMaterial()
    const refractionMaterial = new RefractionMaterial({ envMap: envFbo.texture, backfaceMap: backfaceFbo.texture, resolution: [size.width, size.height] })
    return [envFbo, backfaceFbo, backfaceMaterial, refractionMaterial]
  }, [size])

  // Create random position data

  const dummy = useMemo(() => new Object3D(), [])
  const diamonds = useMemo(
    () =>
      new Array(80).fill().map((_, i) => ({
        position: [i < 5 ? 0 : viewport.width / 2 - Math.random() * viewport.width, 40 - Math.random() * 40, i < 5 ? 26 : 10 - Math.random() * 20],
        factor: 0.1 + Math.random(),
        direction: Math.random() < 0.5 ? -1 : 1,
        rotation: [Math.sin(Math.random()) * Math.PI, Math.sin(Math.random()) * Math.PI, Math.cos(Math.random()) * Math.PI]
      })),
    []
  )



  // Render-loop
  useFrame(() => {
    // Update instanced diamonds
    diamonds.forEach((data, i) => {
      const t = clock.getElapsedTime()
      data.position[1] -= (data.factor / 10) * data.direction
      if (data.direction === 1 ? data.position[1] < -50 : data.position[1] > 50)
        data.position = [i < 5 ? 0 : viewport.width / 2 - Math.random() * viewport.width, 50 * data.direction, data.position[2]]
      const { position, rotation, factor } = data
      dummy.position.set(position[0], position[1], position[2])
      dummy.rotation.set(rotation[0] + t * factor, rotation[1] + t * factor, rotation[2] + t * factor)
      dummy.scale.set(1 + factor, 1 + factor, 1 + factor)
      dummy.updateMatrix()
      model.current.setMatrixAt(i, dummy.matrix)
    })
    model.current.instanceMatrix.needsUpdate = true
    // Render env to fbo
    gl.autoClear = false
    camera.layers.set(1)
    gl.setRenderTarget(envFbo)
    gl.render(scene, camera)
    // Render cube backfaces to fbo
    camera.layers.set(0)
    model.current.material = backfaceMaterial
    gl.setRenderTarget(backfaceFbo)
    gl.clearDepth()
    gl.render(scene, camera)
    // Render env to screen
    camera.layers.set(1)
    gl.setRenderTarget(null)
    gl.render(scene, camera)
    gl.clearDepth()
    // Render cube with refraction material to screen
    camera.layers.set(0)
    model.current.material = refractionMaterial
    gl.render(scene, camera)
  }, 1)

  return (
    <instancedMesh ref={model} args={[null, null, diamonds.length]}castShadow receiveShadow>
      <bufferGeometry dispose={false} attach="geometry" {...gltf.__$[1].geometry} />
      <meshBasicMaterial attach="material" />
    </instancedMesh>
  )
}
function Effect({ down }) {
  const composer = useRef()
  const { scene, gl, size, camera } = useThree()
  const aspect = useMemo(() => new Vector2(size.width, size.height), [size])
  useEffect(() => void composer.current.setSize(size.width, size.height), [size])
  useFrame(() => composer.current.render(), 1)
  return (
    <effectComposer ref={composer} args={[gl]}>
      <renderPass attachArray="passes" scene={scene} camera={camera} />
      <waterPass attachArray="passes" factor={2} />
      <unrealBloomPass attachArray="passes" args={[aspect, 2, 1, 0]} />
      <filmPass attachArray="passes" args={[0.25, 0.4, 1500, false]} />
      <glitchPass attachArray="passes" factor={down ? 1 : 0} />
    </effectComposer>
  )
}

function App() {
  const [down, set] = useState(false)
  const mouse = useRef([300, -200])
  const onMouseMove = useCallback(({ clientX: x, clientY: y }) => (mouse.current = [x - window.innerWidth / 2, y - window.innerHeight / 2]), [])

  return (
    <Canvas 
    className="canvas" 
    camera={{ fov: 35, position: [0, 0, 30] }} 
    onMouseMove={onMouseMove} 
    onMouseUp={() => set(false)} 
    onMouseDown={() => set(true)}
    shadowMap gl={{alpha:true, antialias:false}}>
      <Suspense fallback={null}>
        <Background />
        <Diamonds />
        <Effect down={down} />
      </Suspense>
    </Canvas>
  )
}

ReactDOM.render(<App />, document.getElementById("root"))
