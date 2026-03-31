declare module 'react-confetti' {
  import { ComponentType } from 'react';
  const Confetti: ComponentType<any>;
  export default Confetti;
}

// View Transitions API
interface Document {
  startViewTransition(callback: () => void | Promise<void>): ViewTransition;
}
interface ViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
}
