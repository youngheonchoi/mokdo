import { Scene, GameObjects } from 'phaser';
import { fetchHealth } from '../../api/health';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 300, 'logo');

        this.title = this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const apiStatus = this.add.text(512, 540, 'API 연결 확인 중...', {
            fontFamily: 'Arial', fontSize: 22, color: '#ffffff',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        void fetchHealth().then((response) => {
            console.log('[Health API] 연결 성공:', response);

            if (apiStatus.active) {
                apiStatus.setText(`API 연결 성공: ${response.service} (${response.status})`);
                apiStatus.setColor('#86efac');
            }
        }).catch((error: unknown) => {
            console.error('[Health API] 연결 실패:', error);

            if (apiStatus.active) {
                apiStatus.setText('API 연결 실패 (브라우저 콘솔 확인)');
                apiStatus.setColor('#fca5a5');
            }
        });

        this.input.once('pointerdown', () => {

            this.scene.start('Game');

        });
    }
}
