import { Component, OnInit, ViewChild } from '@angular/core';
import { OverlayEventDetail } from '@ionic/core';
import { IonModal } from '@ionic/angular';
import { Router } from '@angular/router';

import { Shop } from '../models/shop.model';

import { SettingsService } from "../services/settings.service";
import { ShopService } from '../services/shop.service';

import { getAbsoluteDate } from "../utils/helper-functions";
import { TutorialService } from '../services/tutorial.service';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
    @ViewChild(IonModal) modal: IonModal;
    allShops: Shop[] = [];
    shopName: string = 'New Shop';
    mode: string = 'create';
    modalTitle: string = 'Start Shop';
    currentShopId: number | null;
    loadingShop: boolean = false;

    constructor(private settings: SettingsService, private shops: ShopService,
                private router: Router, public tutorial: TutorialService) {
        this.tutorial.createDemoShop.subscribe(() => { this.newShop(true); })
        this.tutorial.startDemoShop.subscribe(() => { this.confirm('create'); })
        this.tutorial.deleteDemoShop.subscribe((id: number) => { this.deleteShop(id) })
    }
    async ngOnInit(): Promise<void> {
        await this.settings.init()
        this.allShops = await this.shops.getAllShops()
        this.shopName = await this.getDefaultShopName()
    }

    formatDate(date: Date): string {
        return getAbsoluteDate(date)
    }

    private async getDefaultShopName() {
        let shopCount = (await this.shops.allShops).length
        return `Shop #${shopCount+1}`
    }

    async newShop(demo: boolean = false) {
        this.mode = 'create';
        this.modalTitle = 'Start Shop';
        this.shopName = demo ? 'Demo Shop' : await this.getDefaultShopName();
        this.loadingShop = true;
        this.modal.present();
    }

    
    async editShop(id: number) {
        this.mode = 'edit';
        this.modalTitle = 'Edit Shop';
        this.currentShopId = id;
        this.shopName = (await this.shops.getShop(id)).title;
        this.loadingShop = true;
        this.modal.present();
    }
    
    async deleteShop(id: number) {
        this.mode = 'delete';
        this.modalTitle = 'Delete Shop';
        this.currentShopId = id;
        this.shopName = (await this.shops.getShop(id)).title;
        this.loadingShop = true;
        this.modal.present();
    }

    onWillDismiss(event: Event) {
        const ev = event as CustomEvent<OverlayEventDetail<string>>;
        if (ev.detail.role == 'create' && this.shopName.length > 0) {
            this.shops.saveShop(new Shop(this.shopName))
                .then((allShops) => {
                    this.allShops = allShops || [];
                    this.router.navigate(['/shop', (this.allShops.length - 1)]);
                })
        }
        else if (ev.detail.role == 'edit' && this.shopName.length > 0 && this.currentShopId != null) {
            this.shops.updateShopTitle(this.currentShopId, this.shopName)
                .then((allShops) => {
                    this.allShops = allShops || [];
                })
        }
        else if (ev.detail.role == 'delete' && this.currentShopId != null) {
            this.shops.deleteShop(this.currentShopId)
                .then((allShops) => {
                    this.allShops = allShops || [];
                })
        }
        this.loadingShop = false;
        this.currentShopId = null;
    }

    cancel() {
        this.modal.dismiss(null, 'cancel')
    }

    confirm(role: string = 'confirm') {
        this.modal.dismiss(this.shopName, role)
    }
}
