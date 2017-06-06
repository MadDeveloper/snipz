import { Component, OnInit } from '@angular/core'
import { AuthenticationService } from 'app/services/authentication/authentication.service'
import { User } from '../interfaces/user/index'

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit {

    private activeTab = 'profile'
    private user: User
    private usernameSnapshot: string
    private oldPassword: string
    private password: string
    private passwordConfirm: string

    constructor(private authentication: AuthenticationService) { }

    ngOnInit() {
        this.user = this.authentication.currentUser()
        this.usernameSnapshot = this.user.username
    }

    changeTab(tab: string) {
        this.activeTab = tab
    }

}
