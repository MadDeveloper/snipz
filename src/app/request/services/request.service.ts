import { AngularFireDatabase } from 'angularfire2/database'
import { AuthenticationService } from '../../authentication/services/authentication.service'
import { Code } from '../../code/interfaces/code'
import { CodeEditorService } from '../../code/services/code-editor.service'
import { CodeService } from '../../code/services/code.service'
import { Injectable } from '@angular/core'
import { LanguageService } from '../../code/services/language.service'
import { NotificationService } from '../../notification/services/notification.service'
import { Observable } from 'rxjs/Observable'
import { Request } from '../interfaces/request'
import { Snippet } from '../../snippet/interfaces/snippet'
import { SnippetService } from '../../snippet/services/snippet.service'
import { User } from '../../core/interfaces/user/user'
import { UserService } from '../../core/services/user/user.service'

@Injectable()
export class RequestService {
    storedSnippet: Partial<Snippet>

    constructor(
        private codeEditor: CodeEditorService,
        private user: UserService,
        private language: LanguageService,
        private code: CodeService,
        private database: AngularFireDatabase,
        private notification: NotificationService,
        private snippet: SnippetService,
        private authentication: AuthenticationService) { }

    all(user: User): Observable<Request[]> {
        return this
            .snippet
            .author(user)
            .map(snippets => Observable.zip(...snippets.map((snippet: Snippet) => this.forSnippet(snippet))))
            .mergeAll()
            .map((snippets: Request[][]): Request[] => [].concat(...snippets).reverse())
    }

    find(id: string, snippet: Snippet): Observable<Request> {
        return this
            .database
            .object(this.requestPath(id, snippet))
            .map((request: any): Request => this.forgeFromDatabase(request, snippet))
    }

    forSnippet(snippet: Snippet): Observable<Request[]> {
        return this
            .database
            .list(this.requestsSnippetPath(snippet))
            .map((requests: any[]): Request[] => requests.map(request => this.forgeFromDatabase(request, snippet)))
    }

    forge(user: User, code: Code, snippet: Snippet): Request {
        return {
            id: null,
            snippet: this.snippet.find(snippet.id),
            code: Observable.of(code)
        }
    }

    forgeFromDatabase(request: any, snippet: Snippet): Request {
        if (request.$value) {
            return {
                id: request.$key,
                snippet: this.snippet.find(snippet.id),
                code: this.code.find(request.$value, snippet)
            }
        }

        return null
    }

    accept(request: Request, code: Code, author: User, snippet: Snippet) {
        return new Promise(async (resolve, reject) => {
            try {
                const existingCode = await this.code.findCodeByLanguage(code.language, snippet, code)
                const currentUser = this.authentication.user

                if (existingCode) {
                    await this.code.delete(existingCode, snippet)
                }

                // TODO: bulk
                await this.database.object(this.code.codePath(code.id, snippet)).update({ validated: true })
                await this.database.object(this.requestPath(request.id, snippet)).remove()
                await this.addContribution(author, snippet)

                if (!existingCode) {
                    await this.snippet.increaseCodesCounter(snippet)
                }

                await this.notification.requestAccepted(currentUser, snippet, author, request, code.language.text)

                resolve()
            } catch (error) {
                // TODO: sentry
                console.error(error)
                reject(error)
            }
        })
    }

    reject(request: Request, code: Code, author: User, snippet: Snippet) {
        return new Promise(async (resolve, reject) => {
            const currentUser = this.authentication.user

            try {
                // TODO: bulk
                await this.database.object(this.code.codePath(code.id, snippet)).remove()
                await this.database.object(this.requestPath(request.id, snippet)).remove()
                await this.notification.requestRejected(currentUser, snippet, author, request, code.language.text)
                resolve()
            } catch (error) {
                // TODO: sentry
                console.error(error)
                reject(error)
            }
        })
    }

    addContribution(author: User, snippet: Snippet) {
        return this
            .database
            .object(this.snippet.authorContributionsPath(author))
            .update({ [snippet.id]: true })
    }

    forgeForDatabase(code: Code, author: User, asRequest = false) {
        let request = {
            user: author.id,
            code: code.code,
            language: code.language.value
        }

        if (asRequest) {
            request = Object.assign({}, request, {
                request: true,
                validated: false
            })
        }

        return request
    }

    add(code: Code, author: User, snippet: Snippet, snippetAuthor: User) {
        return new Promise(async (resolve, reject) => {
            try {
                const request = this.forge(author, code, snippet)

                await this
                    .code
                    .create(code, snippet, author, true)

                // TODO: bulk
                request.id = await this
                    .database
                    .list(this.requestsSnippetPath(snippet))
                    .push(code.id)
                    .key

                await this
                    .notification
                    .request(author, snippet, snippetAuthor, request)

                resolve(request)
            } catch (error) {
                reject(error)
            }
        })
    }

    deleteAll(snippet: Snippet) {
        return this
            .database
            .list(this.requestsSnippetPath(snippet))
            .remove()
    }

    deleteAllAsUpdates(snippet: Snippet) {
        const updates = {}

        updates[this.requestsSnippetPath(snippet)] = null

        return updates
    }

    requestsPath() {
        return '/requests'
    }

    requestsSnippetPath(snippet: Snippet) {
        return `${this.requestsPath()}/${snippet.id}`
    }

    requestPath(id: string, snippet: Snippet) {
        return `${this.requestsSnippetPath(snippet)}/${id}`
    }

    uniqFirebaseId() {
        return this.database.app.database().ref().push().key
    }
}
