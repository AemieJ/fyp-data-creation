import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// conservative daily post (cdp) website

let titles = [];
let tags = [];
let links = [];

function displayDetails(titles, tags, links) {
    console.log(`Number of titles: ${titles.length}`);
    console.log(`Number of tags: ${tags.length}`);
    console.log(`Number of links: ${links.length}`);
    console.log("\n");
}

function addToCSV(titles, texts, dates) {
    let filePath = "./fake/fake_cdp_content.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Publishing Date", "Len", "Content"] });

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Publishing Date": dates,
        "Len": texts.length,
        "Content": texts
    });

    log.end();
}

function addToCSVNoTexts(titles, tags, links) {
    let filePath = "./fake/fake_cdp_title.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Tags", "Source"] });

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    let length = titles.length;

    for (let row = 0; row < length; ++row) {
        log.write({
            "Title": titles[row],
            "Tags": tags[row],
            "Source": links[row]
        });
    }

    log.end();
}

// extract titles
// extract link to title
// extract data of title
// extract text of document/news

function grabText() {
    let lst_ = [];
    document.querySelectorAll("div.content-container p").forEach((el) => {
        text = el.innerText;
        if (text.length != 0) {
            lst_.push(text)
        }
    });

    let d = document.querySelector(".date-published").innerText.split(" ");
    let date = d.slice(d.length - 3, d.length).join(" ");
    let content = lst_.join(" ");

    return { content, date };
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    let textData = await page.evaluate(grabText);
    await browser.close();

    return textData;

}

function detailsExtract() {
    let titles = [];
    let tags = [];
    let links = [];

    document.querySelectorAll("article .col-md-8 > h4 a").forEach((el) => {
        titles.push(el.getAttribute("title"));
        links.push(el.href);
    });

    document.querySelectorAll("div.cat-link").forEach((el) => {
        tags.push(el.innerText);
    });

    return { titles, links, tags };

}

async function paginationAndScrape() {
    console.log("Pagination scrape");
    let size = 6;

    for (let page_ = 1; page_ < 95; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size;
        let URL = `https://conservativedailypost.com/page/${page_+1}/?s=health`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(URL, { waitUntil: 'load', timeout: 0 });
        console.log(`Page ${page_ + 1} has been loaded`);

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.tags, data.links);

        let rows = data.links.length;
        for (let row = 0; row < rows; ++row) {
            console.log(`Find the textual content for link ${row + 1}`);
            let link = data.links[row];
            let textData = await textExtract(link);
            let text = textData.content;
            let date = textData.date;

            if (text.length != 0)
                addToCSV(data.titles[row], text, date);
        }

        titles = titles.concat(data.titles);
        links = links.concat(data.links);
        tags = tags.concat(data.tags);
        displayDetails(titles, tags, links);

        await browser.close();
    }
}

async function extractPostDetails() {
    const URL = 'https://conservativedailypost.com/?s=health';
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    // first page already scraped

    let data = await page.evaluate(detailsExtract);
    addToCSVNoTexts(data.titles, data.tags, data.links);

    let rows = data.links.length;
    for (let row = 0; row < rows; ++row) {
        console.log(`Find the textual content for link ${row + 1}`);
        let link = data.links[row];
        let textData = await textExtract(link);
        let text = textData.content;
        let date = textData.date;

        if (text.length != 0)
            addToCSV(data.titles[row], text, date);
    }

    titles = titles.concat(data.titles);
    links = links.concat(data.links);
    tags = tags.concat(data.tags);
    displayDetails(titles, tags, links);

    await page.exposeFunction("paginationAndScrape", paginationAndScrape);
    await page.evaluate(async () => {
        await paginationAndScrape();
        return true;
    });

    await browser.close();
    return { titles, links, tags };
}

extractPostDetails().then((details) => { });
