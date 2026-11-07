import './style.css';
import { Game } from './core/Game.js';

try {
  const game = new Game();
  game.start();
} catch (err) {
  // Show startup errors on screen so they are easy to copy and share.
  console.error(err);
  const box = document.getElementById('error');
  box.hidden = false;
  box.textContent = 'ECHO failed to start:\n' + (err && err.stack ? err.stack : err);
}
