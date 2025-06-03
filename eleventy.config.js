import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItVideo from "markdown-it-video";
import { html5Media } from 'markdown-it-html5-media';
import pluginTOC from 'eleventy-plugin-toc';
import pluginSEO from "eleventy-plugin-seo";
import pluginSASS from "eleventy-sass";
import pluginSitemap from "@quasibit/eleventy-plugin-sitemap";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginNavigation from "@11ty/eleventy-navigation";

import { DateTime } from "luxon";
import fs from 'fs';
import nunjucks from "nunjucks";
import markdown from 'nunjucks-markdown';
import markdownItAttrs from 'markdown-it-attrs';
import pluginFavicon from "eleventy-plugin-gen-favicons";
import _ from "lodash";

export default async function (el) {
    /* Passthrough Copy */
    el.addPassthroughCopy("fonts");
    el.addPassthroughCopy("CNAME");
    el.setDataDeepMerge(true);

    /* SEO */
    const seoConfig = JSON.parse(fs.readFileSync('./_data/seo.json', 'utf8'));
    el.addPlugin(pluginSEO, seoConfig);
    el.addPlugin(pluginSitemap, {
        sitemap: {
            hostname: "https://phd.maximvdw.be",
        },
    });
    el.addPlugin(pluginFavicon);
    el.addPlugin(pluginRss);
    //el.addPlugin(pluginValidator);
    el.addPlugin(pluginNavigation);

    /* Markdown */
    const md = markdownIt({ html: true });
    md.use(markdownItAnchor);
    md.use(markdownItAttrs, {
        leftDelimiter: '{$',
        rightDelimiter: '$}',
        allowedAttributes: []
    });
    const highlighter = el.markdownHighlighter;
    el.markdownHighlighter = (code, lang, fence) => {
        const result = highlighter(code, lang, fence);
        return result === "" ? "<pre style='display: none'></pre>" : result;
    };
    md.use(markdownItVideo, {
        youtube: { width: 640, height: 390 },
        vimeo: { width: 500, height: 281 },
        vine: { width: 600, height: 600, embed: 'simple' },
        prezi: { width: 550, height: 400 }
    });
    md.use(html5Media);
    el.setLibrary("md", md);
    el.addPlugin(pluginTOC, {
        tags: ['h2'],
        ul: true
    });

    /* Stylesheets */
    el.addPlugin(pluginSASS, [
        {
            compileOptions: {
                permalink: function() {
                    return (data) => {
                        return data.page.filePathStem.replace(/^\/_scss\//, "/css/") + ".css";
                    };
                }
            },
            sass: {
                style: "expanded",
                sourceMap: true
            }
        }, {
            rev: true,
            when: { ELEVENTY_ENV: "stage" }
        }, {
            sass: {
                style: "compressed",
                sourceMap: false
            },
            rev: true,
            when: [ { ELEVENTY_ENV: "production" }, { ELEVENTY_ENV: false } ]
        }
    ]);

    /* Nunjucks */
    const njkEnv = new nunjucks.Environment(
        new nunjucks.FileSystemLoader("_includes")
    );
    markdown.register(njkEnv, (src, _) => {
        return md.render(src);
    });
    el.setLibrary("njk", njkEnv);

    configureCollections(el);
    configureFilters(el);

    el.addWatchTarget("_scss");
    el.setChokidarConfig({
		usePolling: true,
		interval: 500,
	});
    
    el.setBrowserSyncConfig({
        callbacks: {
            ready: function(_, browserSync) {
                const content_404 = fs.readFileSync('_site/404.html');
                browserSync.addMiddleware("*", (req, res) => {
                    // Provides the 404 content without redirect.
                    res.write(content_404);
                    res.end();
                });
            },
        },
        ui: false,
        ghostMode: false
    });

    return {
        templateFormats: [
            "ico",
            "njk",
            "jpg",
            "md",
            "html",
            "liquid",
            "svg",
            "png",
            "pdf",
            'gif',
            "mp4",
            "webm",
            "webp", 
            "zip" 
        ],
        markdownTemplateEngine: "liquid",
        htmlTemplateEngine: "njk",
        dataTemplateEngine: "njk",
        dir: {
            input: ".",
            includes: "_includes",
            layouts: "_layouts",
            data: "_data",
            output: "_site"
        }
    };
};

async function configureCollections(el) {
    el.addCollection("posts_year", (collection) => {
        return _.chain(collection.getFilteredByTag("posts").sort((a, b) => a.date - b.date))
            .groupBy((post) => post.date.getFullYear())
            .toPairs()
            .reverse()
            .value();
    });
    el.addCollection("publications_year", (collection) => {
        return _.chain(collection.getFilteredByTag("publications").sort((a, b) => a.date - b.date))
            .groupBy((post) => post.date.getFullYear())
            .toPairs()
            .reverse()
            .value();
    });
}

async function configureFilters(el) {
    el.addFilter("readableDate", dateObj => {
        return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("cccc, dd LLL yyyy");
    });

    el.addFilter('htmlDateString', (dateObj) => {
        return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd');
    });

    el.addFilter("head", (array, n) => {
        if (n < 0) {
            return array.slice(n);
        }
        return array.slice(0, n);
    });

    el.addFilter("min", (...numbers) => {
        return Math.min.apply(null, numbers);
    });
}
