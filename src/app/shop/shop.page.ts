/* Library Imports */
import { Component,  OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoiceRecorder } from "capacitor-voice-recorder";
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonModal } from '@ionic/angular';
import { OverlayEventDetail } from "@ionic/core";
import { Subscription } from 'rxjs';

/* Model Imports */
import { Content } from '../models/content.model';

/* Utility Imports */
import { getPreciseTime } from "../utils/helper-functions";

/* Service Imports */
import { SettingsService } from '../services/settings.service';
import { ShopService } from '../services/shop.service';
import { TimerService } from '../services/timer.service';
import { ToastService } from '../services/toast.service';
import { AddImageService } from '../services/add-image.service';

@Component({
    selector: 'app-shop',
    templateUrl: './shop.page.html',
    styleUrls: ['./shop.page.scss'],
})
export class ShopPage implements OnInit, OnDestroy {
    @ViewChild('messagesContainer') content: IonContent;
    @ViewChild(IonModal) modal: IonModal;

    /* Local Setting Variables */
    nameToShow: string = 'Jacob';
    showStarterMessage: boolean = true;
    messageFontSize: number = 11;
    shopId: number = -1;
    
    /* Other Local Variables */
    messages: Content[] = [];
    audioStatus: string = 'NONE';
    showImageView: boolean = false;
    messageToDelete: number = -1;
    deletingType: string = 'shop content';
    imageViewSrc: string = '';

    /* Subscription Holders */
    currentRouteSubscription: Subscription;
    addImageSubscription: Subscription;

    constructor(private settings: SettingsService, private shops: ShopService, public  timer: TimerService,
                private activeRoute: ActivatedRoute, private toast: ToastService, private addImage: AddImageService) {
        /* Subscribe to activeRoute to get the shopID */
        this.currentRouteSubscription = this.activeRoute.params.subscribe(async (route: any) => {
            this.shopId = route.id;
            this.messages = (await this.shops.getShop(this.shopId)).data
        })

        /* Subscribe to afterRestart, for when the app returns to focus after taking a picture */
        this.addImageSubscription = this.addImage.afterRestart.subscribe((imageData: string) => {
            this.post('photo take', true, 'command');
            this.post(imageData || '', false, 'image')
            this.scroll(1000, true)
        })

        /* Check for recording permissions, and ask if needed */
        VoiceRecorder.hasAudioRecordingPermission()
            .then((result: any) => {
                if (result.value == false) {
                    VoiceRecorder.requestAudioRecordingPermission()
                        .then((result: any) => {
                            console.log(result);
                        })
                }
            })
            .catch((error: any) => {
                console.log(error);
            })

        /* Check for camera permissions, and ask if needed */
        Camera.checkPermissions()
            .then((result: any) => {
                if (result.camera != 'granted') {
                    Camera.requestPermissions()
                }
            })
            .catch((error: any) => {
                console.log(error);
            })
    }
    async ngOnInit(): Promise<void> {
        await this.settings.init()
        let settings = this.settings.appSettings
        this.nameToShow = settings.nameToShow || 'Jacob'
        this.showStarterMessage = settings.showStarterMessage ? true : settings.showStarterMessage == false ? false : false
        this.messageFontSize = settings.messageFontSize || 11
        this.scroll(1000, true)
    }
    ngOnDestroy(): void {
        this.addImageSubscription.unsubscribe()
        this.currentRouteSubscription.unsubscribe()
    }

    private scroll(delay: number = 500, again: boolean = false) {
        setTimeout(() => {
            this.content.scrollToBottom(200);

            if (again) this.scroll(delay)
        }, delay);
    }

    post(content: string, sent: boolean = true, type: 'note' | 'command' | 'image' | 'audio' = 'note') {
        this.messages.push({
            date: getPreciseTime(new Date()),
            content: content,
            type: type,
            sent: sent
        })
        if (this.shopId >= 0) {
            this.shops.updateShopData(this.shopId, this.messages)
        }
        else {
            this.toast.createToast('Couldn\'t save, please try again later')
        }
    }

    async startAudioRecording() {
        try {
            await VoiceRecorder.startRecording()
            this.updateAudioStatus('RECORDING')

            this.post('audio start', true, 'command')
            this.post('audio recording started', false)

            this.scroll()
        }
        catch (e: any) {
            if (e.message == 'ALREADY_RECORDING') {
                this.toast.createToast('Recording is already started')
            }
        }
    }

    async pauseAudioRecording() {
        try {
            await VoiceRecorder.pauseRecording()
            this.updateAudioStatus('PAUSED')

            this.post('audio pause', true, 'command')
            this.post('audio recording paused', false)

            this.scroll()
        }
        catch (e: any) {
            console.log(e.message);
            if (e.message == 'ALREADY_RECORDING') {
                this.toast.createToast('Recording is already started')
            }
        }
    }

    async resumeAudioRecording() {
        try {
            await VoiceRecorder.resumeRecording()
            this.updateAudioStatus('RECORDING')

            this.post('audio resume', true, 'command')
            this.post('audio recording resumed', false)

            this.scroll()
        }
        catch (e: any) {
            console.log(e.message);
            if (e.message == 'ALREADY_RECORDING') {
                this.toast.createToast('Recording is already started')
            }
        }
    }

    async stopAudioRecording() {
        try {
            let result = await VoiceRecorder.stopRecording()
            this.updateAudioStatus('NONE')

            this.post('audio stop', true, 'command')
            this.post(`data:${result.value.mimeType};base64,${result.value.recordDataBase64}`, false, 'audio')

            this.scroll()
        }
        catch (e: any) {
            console.log(e.message);
            if (e.message == 'ALREADY_RECORDING') {
                this.toast.createToast('Recording is already started')
            }
        }
    }

    private updateAudioStatus(status: string) {
        this.audioStatus = status
    }

    async takePhoto() {
        localStorage.setItem('shopId', ''+this.shopId)
        Camera
            .getPhoto({
                quality: 50,
                resultType: CameraResultType.Base64,
                allowEditing: false,
                saveToGallery: true,
                source: CameraSource.Camera
            })
            .then((result:any) => {
                this.post('photo take', true, 'command');
                this.post(`data:image/jpeg;base64,${result.base64String}`, false, 'image')
                this.scroll(1000, true)
            })
            .catch((error) => {
                this.toast.createToast('Something went wrong, please try again')
                console.log(error);
            })
    }

    startTimer() {
        if (this.timer.isActive) {
            this.toast.createToast('Timer is already running')
            return
        }
        this.timer.begin()
        this.post('timer start', true, 'command');
        this.post('timer has been started', false)
        this.scroll()
    }

    addLap() {
        if (!this.timer.isActive) {
            this.toast.createToast('No timer running')
            return
        }
        this.timer.lap()
        this.post('timer lap', true, 'command');
        this.post('a lap has been added to the timer', false)
        this.scroll()
    }

    stopTimer() {
        if (!this.timer.isActive) {
            this.toast.createToast('No timer running')
            return
        }
        this.timer.stop()
        this.post('timer stop', true, 'command');
        this.post('timer has been stopped', false);
        this.scroll()
    }

    timeFromTimer() {
        if (!this.timer.wasActive) {
            this.toast.createToast('No timer has finished')
            return
        }
        this.post('timer time', true, 'command')
        this.post(this.timer.getLapTimes(), false)
        this.scroll()
    }

    send(input: any) {
        let message = input.value.toString()
        if (message.length == 0) return

        switch (message.toLowerCase()) {
            case 'timer start':
                this.startTimer()
            break;
            case 'timer lap':
                this.addLap()
            break;
            case 'timer stop':
                this.stopTimer()
            break;
            case 'timer show time':
                this.timeFromTimer()
            break;
            case 'audio start':
                this.startAudioRecording()
            break;
            case 'audio pause':
                this.pauseAudioRecording()
            break;
            case 'audio resume':
                this.resumeAudioRecording()
            break;
            case 'audio stop':
                this.stopAudioRecording()
            break;
            case 'photo take':
                this.takePhoto()
            break;
            default:
                this.post(message)
                this.post('Note saved', false)
            break;
        }

        input.value = ''
        this.scroll()
    }

    deleteMessage(id: number) {
        this.messageToDelete = id;
        if (['image', 'audio', 'note', 'command'].includes(this.messages[id].type))
            this.deletingType = this.messages[id].type
        if (this.messages[id].type == 'note' && !this.messages[id].sent)
            this.deletingType = 'result'
        this.modal.present();
    }

    openImageView(src: string) {
        this.imageViewSrc = src;
        this.showImageView = true;
    }

    closeImageView() {
        this.imageViewSrc = '';
        this.showImageView = false;
    }

    onWillDismiss(event: Event) {
        const ev = event as CustomEvent<OverlayEventDetail<string>>;
        if (ev.detail.role == 'delete' && this.messageToDelete >= 0) {
            this.messages = this.messages.filter((value: any, index: number) => {
                if (index == this.messageToDelete) return false
                return true
            })
            if (this.shopId >= 0) {
                this.shops.updateShopData(this.shopId, this.messages)
            }
            else {
                this.toast.createToast('Couldn\'t save, please try again later')
            }
        }
        this.messageToDelete = -1
    }

    deleteContent() {
        this.modal.dismiss(null, 'delete')
    }

    cancel() {
        this.modal.dismiss(null, 'cancel')
    }
}
