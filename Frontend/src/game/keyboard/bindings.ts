

type Direction = 'up' | 'down' | 'stop';
type PlayerSide = 'left' | 'right';
type KeysState = { up: boolean; down: boolean };

export class LocalInputHandler {
	private static instance: LocalInputHandler;
	public static getInstance(): LocalInputHandler {
		LocalInputHandler.instance ??= new LocalInputHandler();
		return LocalInputHandler.instance;
	}

	public directions: Record<PlayerSide, Direction> = { left: 'stop', right: 'stop' };
	private keysDown: Record<PlayerSide, KeysState> = {
		left: { up: false, down: false },
		right: { up: false, down: false },
	};

	private readonly map: Record<string, { side: PlayerSide; dir: Exclude<Direction, 'stop'> }> = {
		w: { side: 'left', dir: 'up' },
		s: { side: 'left', dir: 'down' },
		arrowup: { side: 'right', dir: 'up' },
		arrowdown: { side: 'right', dir: 'down' },
	};

	private recompute(side: PlayerSide): Direction {
		const { up, down } = this.keysDown[side];
		return up === down ? 'stop' : up ? 'up' : 'down';
	}

	public keyDown(key: string): boolean {
		const entry = this.map[key.toLowerCase()];
		if (!entry) {
			return false;
		}
		const { side, dir } = entry;
		if (!this.keysDown[side][dir]) {
			this.keysDown[side][dir] = true;
			this.directions[side] = this.recompute(side);
		}
		return true;
	}

	public keyUp(key: string): boolean {
		const entry = this.map[key.toLowerCase()];
		if (!entry) {
			return false;
		}
		const { side, dir } = entry;
		if (this.keysDown[side][dir]) {
			this.keysDown[side][dir] = false;
			this.directions[side] = this.recompute(side);
		}
		return true;
	}

	public reset(): void {
		this.directions.left = 'stop';
		this.directions.right = 'stop';
		this.keysDown.left = { up: false, down: false };
		this.keysDown.right = { up: false, down: false };
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('keydown', onSpaceKeyDown);
	}

	public listen(): void {
		this.reset();
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('keydown', onSpaceKeyDown);
	}
}

const onKeyDown = (event: KeyboardEvent) => {
	if (event.repeat) {
		return;
	}
	if (LocalInputHandler.getInstance().keyDown(event.key)) {
		event.preventDefault();
	}
};

const onKeyUp = (event: KeyboardEvent) => {
	if (LocalInputHandler.getInstance().keyUp(event.key)) {
		event.preventDefault();
	}
};

const onSpaceKeyDown = (event: KeyboardEvent) => {
	if (event.code === 'Space') {
		event.preventDefault();
	}
};

export const listenLocalPlayerInputs = () => LocalInputHandler.getInstance().listen();