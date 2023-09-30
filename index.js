const express = require('express');
const axios = require("axios");
const lodash = require('lodash');

const app = express();
const port = process.env.PORT || 3000;

let blogData = null;

const fetchAndAnalyzeBlogData = async () => {
    try {
        const response = await axios.get("https://intent-kit-16.hasura.app/api/rest/blogs", {
            headers: {
                "x-hasura-admin-secret": "32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6",
            }
        });
        blogData = response.data.blogs;

        // **Data Analysis**
        const total = blogData.length;
        const longestTitle = lodash.maxBy(blogData, 'title.length');
        const blogsWithPrivacy = blogData.filter((blog) =>
            blog.title.toLowerCase().includes('privacy')
        );
        const uniqueBlogTitles = lodash.uniqBy(blogData, 'title');


        // **Response**
        const statistics = {
            total,
            longestTitle: longestTitle.title,
            blogsWithPrivacy: blogsWithPrivacy.length,
            uniqueBlogTitlesArray: uniqueBlogTitles.map((blog) => blog.title),
        };

        return statistics;
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const memoizedFetchAndAnalyze = lodash.memoize(fetchAndAnalyzeBlogData, () => 'blogStats', 300000);

const searchBlogs = async (query) => {
    try {
        if (!blogData) {
            console.log('Cannot perform the search action as you have no blogs. Kindly fetch the data first.'); return;
        }
        const searchResults = blogData.filter((blog) =>
            blog.title.toLowerCase().includes(query)
        );


        return searchResults;
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const memoizedSearchBlogs = lodash.memoize(searchBlogs, (query) => `blogSearch:${query}`, 300000);


app.use("/api/blog-stats", async (req, res) => {
    try {
        // **Data Retrieval**
        const statistics = await memoizedFetchAndAnalyze();

        res.json(statistics);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    };
});


// **Blog Search Endpoint**
app.use("/api/blog-search", async (req, res) => {
    try {
        if (!req.query.query) {
            res.status(400).json({ error: 'Query parameter is required.' });
            return;
        }
        const query = req.query.query.toLowerCase();

        const cachedResults = memoizedSearchBlogs(query);

        if (cachedResults && cachedResults.length > 0) {
            res.json(cachedResults);
            return;
        }
        const searchResults = await searchBlogs(query);

        if (searchResults.length === 0) {
            res.status(404).json({ error: 'No matching blogs found.' });
            return;
        }

        memoizedSearchBlogs.cache.set(query, searchResults);

        res.json(searchResults);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})