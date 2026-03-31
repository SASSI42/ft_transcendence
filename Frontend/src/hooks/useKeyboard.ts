import { useEffect } from 'react';
import { LocalInputHandler } from '../game/keyboard/bindings';

export function useKeyboard(isActive: boolean) {
  useEffect(() => {
    const inputHandler = LocalInputHandler.getInstance();

    if (isActive) {
      inputHandler.listen();
    } else {
      inputHandler.reset();
    }

    return () => {
      inputHandler.reset();
    };
  }, [isActive]);
}
