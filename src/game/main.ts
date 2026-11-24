import { Hub } from './scenes/Hub';
import { BossLobby } from './scenes/BossLobby';
import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { CharacterSelect } from './scenes/CharacterSelect';
import { CharacterCreate } from './scenes/CharacterCreate';
import { IntroStory } from './scenes/IntroStory';
import { Village } from './scenes/Village';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1280,
    height: 800,
    parent: 'game-container',
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    backgroundColor: '#028af8',
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CharacterSelect,
        CharacterCreate,
        IntroStory,
        Village,
        Hub,
        MainGame,
        BossLobby,
        new MainGame('BossRoom'),
        GameOver
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
