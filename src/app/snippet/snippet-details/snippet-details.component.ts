import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Comment } from '../interfaces/comment'
import * as $ from 'jquery'
import { Subscription } from 'rxjs/Subscription'
import { Snippet } from '../interfaces/snippet'
import { Code } from '../../code/interfaces/code'
import { Language } from '../../code/interfaces/language'
import { AuthenticationService } from '../../authentication/services/authentication.service'
import { RequestService } from '../../request/services/request.service'
import { LikeService } from '../services/like.service'
import { CodeService } from '../../code/services/code.service'
import { SweetAlertService } from 'ng2-sweetalert2'
import { CommentService } from '../services/comment.service'
import { Observable } from 'rxjs/Observable'
import { Like } from '../interfaces/like'
import { SnippetService } from '../services/snippet.service'
import { User } from '../../core/interfaces/user/user'

@Component({
  selector: 'app-snippet-details',
  templateUrl: './snippet-details.component.html',
  styleUrls: ['./snippet-details.component.scss']
})
export class SnippetDetailsComponent implements OnInit, OnDestroy {
    notification: any
    snippet: Snippet
    likes: Observable<Like[]>
    liked = false
    codes: Code[] = []
    codesLoaded = false
    codesObserver: Subscription
    comments: Observable<Comment[]>
    @ViewChild('comment')
    comment: ElementRef
    ownSnippet = false
    authorObserver: Subscription
    likedObserver: Subscription
    hasPendingRequests = false
    loaded = false
    requestCodes: Code[] = []
    newCodes: Code[] = []
    isAuthenticated: boolean
    snippetAuthor: User
    user: User

    constructor(
        private commentService: CommentService,
        private route: ActivatedRoute,
        private authentication: AuthenticationService,
        private request: RequestService,
        private router: Router,
        private likeService: LikeService,
        private codeService: CodeService,
        private swal: SweetAlertService,
        private snippetService: SnippetService) { }

    ngOnInit() {
        this.route
            .data
            .subscribe(async (data: { snippet: Snippet }) => {
                this.user = this.authentication.currentUser()

                this.snippet = data[0]

                if (this.snippet) {
                    this.isAuthenticated = this.authentication.logged
                    this.comments = this.commentService.all(this.snippet)
                    this.likes = this.likeService.all(this.snippet)
                    this.loadCodes()

                    if (this.user) {
                        this.loadSnippetAuthor()
                        this.likedObserver = this.likeService.liked(this.snippet).subscribe(liked => this.liked = liked)
                        this.hasPendingRequests = (await this.request.forSnippet(this.snippet)).length > 0
                    }
                }
            })
    }

    ngOnDestroy() {
        this.closeSubscriptions()
    }

    closeSubscriptions() {
        if (this.authorObserver) {
            this.authorObserver.unsubscribe()
        }

        if (this.likedObserver) {
            this.likedObserver.unsubscribe()
        }
    }

    loadSnippetAuthor() {
        this.authorObserver = this.snippet.author.subscribe(author => {
            this.snippetAuthor = author

            if (author && author.email) {
                this.ownSnippet = this.user.email === author.email
            }
        })
    }

    loadCodes() {
        this.codesObserver = this
            .codeService
            .all(this.snippet)
            .subscribe((codes: Code[]) => {
                this.codes = codes
                this.codesLoaded = true
                this.loaded = true
            })
    }

    focusComment() {
        this.comment.nativeElement.focus()
    }

    addComment(event: Event) {
        event.preventDefault()

        const commentContent = this.comment.nativeElement.value.trim()

        if (commentContent.length > 0) {
            const author = this.authentication.currentUser()

            this.commentService.add(commentContent, author, this.snippet, this.snippetAuthor)
            this.comment.nativeElement.value = ''
        }
    }

    like() {
        if (!this.liked) {
            this.likeService.like(this.snippet, this.snippetAuthor)
            this.liked = true
        } else {
            this.unlike()
        }
    }

    unlike() {
        this.likeService.unlike(this.snippet)
        this.liked = false
    }

    goToRequests() {
        this.router.navigate(['/requests'])
    }

    async confirmDelete() {
        try {
            const rejected = await this.swal.swal({
                title: 'Are you sure?',
                text: `You won't be able to get back your snippet.`,
                type: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel'
            })

            if (rejected) {
                this.delete()
            }
        } catch (reason) {
            // we do nothing
        }
    }

    async delete() {
        try {
            await this.snippetService.delete(this.snippet)
            this.router.navigate(['/profile'])
        } catch (error) {
            this.swal.swal({
                title: 'Oops...',
                text: 'Something went wrong! Please retry again or later.',
                type: 'error'
            })
        }
    }
}
