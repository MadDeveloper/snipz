import { ActivatedRoute, Router } from '@angular/router'
import {
    Component,
    HostListener,
    Input,
    OnDestroy,
    OnInit
    } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import { SearchService } from './services/search.service'
import { Snippet } from '../snippet/interfaces/snippet'
import { SnippetService } from '../snippet/services/snippet.service'
import { Subscription } from 'rxjs/Subscription'
import { PaginableResponse } from '../core/interfaces/response/paginable-response'
import { ScrollService } from '../core/services/scroll/scroll.service'
import { MetaService } from '@ngx-meta/core'

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
    terms: string = null
    snippets: Snippet[] = []
    loading = false
    firstLoad = false
    loadingNextPage = false
    termsObserver: Subscription
    total: number
    response: PaginableResponse<Snippet[]>
    error = null

    constructor(
        private route: ActivatedRoute,
        private snippetService: SnippetService,
        private searchService: SearchService,
        private router: Router,
        private scroll: ScrollService,
        private readonly meta: MetaService) { }

    ngOnInit() {
        this.observeTerms()
    }

    ngOnDestroy() {
        this.closeSubscriptions()
    }

    closeSubscriptions() {
        this.termsObserver.unsubscribe()
    }

    changeMeta() {
        this.meta.setTitle(`Search - ${this.terms}`)
    }

    observeTerms() {
        this.termsObserver = this.searchService
            .terms$
            .subscribe(terms => {
                if (!terms) {
                    this.router.navigateByUrl('/')
                } else {
                    if (this.terms !== terms) {
                        this.response = null
                        this.firstLoad = true
                        this.terms = terms
                        this.search()
                        this.changeMeta()
                    }
                }
            })
    }

    hasReachedLastPage(): boolean {
        return this.snippets.length >= this.total
    }

    async search() {
        if (this.firstLoad) {
            this.loading = true
        } else {
            this.loadingNextPage = true
        }

        try {
            this.response = this.response ? (await this.response.next()) as PaginableResponse<Snippet[]> : await this.searchService.search(this.terms)
            this.total = this.response.total

            if (this.firstLoad) {
                this.snippets = this.response.hits
                this.loading = false
                this.firstLoad = false
            } else {
                this.snippets.push(...this.response.hits)
                this.loadingNextPage = false
            }
        } catch (error) {
            // TODO: sentry
            console.error(`Impossible to performs search with remote ElasticSearch server: ${error}`)
            this.error = `An error occurs while searching results,
                if the problem persists please <a href="mailto:contact@sniphub.io">contact us</a>.`
            this.loading = false
        }
    }

    @HostListener('window:scroll', ['$event'])
    onWindowScroll() {
        if (this.scroll.documentScrolledBottom() && !this.loadingNextPage && (!this.response || this.response.canNext)) {
            this.search()
        }
    }
}
