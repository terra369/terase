import '@react-three/fiber';

declare module '@react-three/fiber' {
  interface ThreeElements {
    thinFilmMaterial: ThreeElements['shaderMaterial'];
  }
}
